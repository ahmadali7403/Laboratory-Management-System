import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, resolveWriteTarget, scopeWhere } from "@/lib/scope";
import { fail, handleError, isUuid, json, money, opt, optUuid, paging, parseBody, positive, round2, uuid } from "@/lib/http";
import { nextNumber } from "@/lib/sequence";
import { paymentStatusFor } from "@/lib/lab";
import { PHARMACY_METHOD_VALUES, recordStockMovement, todayUtcDate } from "@/lib/pharmacy";

export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const sp = new URL(request.url).searchParams;
    const { page, pageSize, skip, take } = paging(sp, 20);
    const q = (sp.get("q") || "").trim().slice(0, 100);
    const status = sp.get("status");
    const paymentStatus = sp.get("paymentStatus");

    const and = [scopeWhere(auth.ctx.scope)];
    if (["COMPLETED", "PARTIAL_RETURN", "RETURNED", "CANCELLED"].includes(status)) and.push({ status });
    if (["UNPAID", "PARTIAL", "PAID"].includes(paymentStatus)) and.push({ paymentStatus, status: { not: "CANCELLED" } });
    if (q) {
      and.push({
        OR: [
          { saleNo: { contains: q, mode: "insensitive" } },
          { customerName: { contains: q, mode: "insensitive" } },
          { customerPhone: { contains: q, mode: "insensitive" } },
          { patient: { name: { contains: q, mode: "insensitive" } } },
          { patient: { mrn: { contains: q, mode: "insensitive" } } },
        ],
      });
    }
    const where = { AND: and };
    const [items, total] = await Promise.all([
      prisma.pharmacySale.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          patient: { select: { id: true, name: true, mrn: true, phone: true } },
          branch: { select: { id: true, name: true } },
          payments: { orderBy: { createdAt: "desc" }, select: { id: true, amount: true, method: true, createdAt: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.pharmacySale.count({ where }),
    ]);
    return json({ items, total, page, pageSize });
  } catch (error) {
    return handleError(error, "Pharmacy sales list");
  }
}

const lineSchema = z.object({
  batchId: uuid,
  quantity: positive,
  discount: money.default(0),
});

const createSchema = z.object({
  branchId: optUuid,
  patientId: optUuid,
  customerName: opt(120),
  customerPhone: opt(30),
  discount: money.default(0),
  paidAmount: money.optional(),
  paymentMethod: z.enum(PHARMACY_METHOD_VALUES).default("CASH"),
  reference: opt(100),
  notes: opt(500),
  items: z.array(lineSchema).min(1, "Add at least one medicine to the cart.").max(100),
});

export async function POST(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const parsed = await parseBody(request, createSchema);
    if (parsed.error) return parsed.error;
    const data = parsed.data;

    const resolved = await resolveWriteTarget(auth.ctx, data, { branchRequired: true });
    if (resolved.error) return resolved.error;
    const { organizationId, branchId } = resolved.target;

    // Combine duplicate batchId lines if any, or reject duplicates cleanly
    const batchIdList = data.items.map((i) => i.batchId);
    if (new Set(batchIdList).size !== batchIdList.length) {
      return fail("Duplicate batch in cart. Adjust the quantity on the existing row instead.", 400);
    }

    let linkedPatient = null;
    if (data.patientId) {
      linkedPatient = await prisma.patient.findFirst({
        where: { id: data.patientId, organizationId, branchId },
        select: { id: true, name: true, phone: true },
      });
      if (!linkedPatient) return fail("Selected customer/patient was not found in this branch.", 404);
    }

    const todayUtc = todayUtcDate();

    const result = await prisma.$transaction(
      async (tx) => {
        // Lock all batches in deterministic order to prevent concurrent overselling.
        const sortedBatchIds = [...batchIdList].sort();
        for (const bid of sortedBatchIds) {
          await tx.$queryRaw`SELECT id FROM "MedicineBatch" WHERE id = ${bid}::uuid FOR UPDATE`;
        }

        const batches = await tx.medicineBatch.findMany({
          where: { id: { in: sortedBatchIds }, organizationId, branchId },
          include: {
            medicine: { select: { id: true, name: true, genericName: true, strength: true, status: true } },
          },
        });
        const batchMap = new Map(batches.map((b) => [b.id, b]));

        let subtotal = 0;
        let itemDiscountTotal = 0;
        const prepared = [];

        for (const reqLine of data.items) {
          const batch = batchMap.get(reqLine.batchId);
          if (!batch || !batch.isActive || batch.medicine.status !== "ACTIVE") {
            return { error: fail("One or more selected medicines/batches are unavailable.", 400) };
          }
          if (new Date(batch.expiryDate) < todayUtc) {
            return { error: fail(`Expired medicine cannot be sold: ${batch.medicine.name} (Batch ${batch.batchNumber}).`, 409) };
          }
          const available = round2(Number(batch.quantity));
          const qty = round2(reqLine.quantity);
          if (qty > available + 0.0001) {
            return { error: fail(`Insufficient stock for ${batch.medicine.name} (Batch ${batch.batchNumber}). Available: ${available}.`, 409) };
          }

          const unitPrice = round2(Number(batch.salePrice));
          const costPrice = round2(Number(batch.purchasePrice));
          const grossLine = round2(qty * unitPrice);
          const itemDisc = round2(reqLine.discount);
          if (itemDisc > grossLine + 0.001) {
            return { error: fail(`Item discount for ${batch.medicine.name} exceeds line subtotal.`, 400) };
          }
          const lineTotal = round2(grossLine - itemDisc);
          subtotal = round2(subtotal + grossLine);
          itemDiscountTotal = round2(itemDiscountTotal + itemDisc);

          prepared.push({
            batch,
            qty,
            available,
            unitPrice,
            costPrice,
            itemDisc,
            lineTotal,
          });
        }

        const afterItemDisc = round2(subtotal - itemDiscountTotal);
        const overallDiscount = round2(data.discount);
        if (overallDiscount > afterItemDisc + 0.001) {
          return { error: fail("Overall discount cannot exceed subtotal after item discounts.", 400) };
        }
        const total = round2(afterItemDisc - overallDiscount);
        const tendered = data.paidAmount !== undefined ? round2(data.paidAmount) : total;
        const appliedPaid = round2(Math.min(Math.max(0, tendered), total));
        const changeAmount = round2(Math.max(0, tendered - total));

        const saleNo = await nextNumber(tx, organizationId, "pharmacy_sale", "PHM");
        const customerName = linkedPatient ? linkedPatient.name : (data.customerName || "Walk-in Customer");
        const customerPhone = linkedPatient ? (data.customerPhone || linkedPatient.phone) : data.customerPhone;

        const sale = await tx.pharmacySale.create({
          data: {
            organizationId,
            branchId,
            saleNo,
            patientId: linkedPatient?.id || null,
            customerName,
            customerPhone: customerPhone || null,
            isWalkIn: !linkedPatient,
            status: "COMPLETED",
            paymentStatus: paymentStatusFor(total, appliedPaid),
            subtotal,
            itemDiscountTotal,
            discount: overallDiscount,
            total,
            paidAmount: appliedPaid,
            notes: data.notes,
            soldByName: auth.ctx.actor.name,
            items: {
              create: prepared.map((p) => ({
                medicineId: p.batch.medicineId,
                batchId: p.batch.id,
                medicineName: p.batch.medicine.name,
                genericName: p.batch.medicine.genericName,
                strength: p.batch.medicine.strength,
                batchNumber: p.batch.batchNumber,
                expiryDate: p.batch.expiryDate,
                quantity: p.qty,
                unitPrice: p.unitPrice,
                costPrice: p.costPrice,
                discount: p.itemDisc,
                lineTotal: p.lineTotal,
              })),
            },
          },
        });

        for (const p of prepared) {
          const nextStock = round2(p.available - p.qty);
          await tx.medicineBatch.update({
            where: { id: p.batch.id },
            data: { quantity: nextStock },
          });
          await recordStockMovement(tx, {
            organizationId,
            branchId,
            medicineId: p.batch.medicineId,
            batchId: p.batch.id,
            type: "SALE_OUT",
            quantityChange: -p.qty,
            balanceBefore: p.available,
            balanceAfter: nextStock,
            referenceType: "PHARMACY_SALE",
            referenceId: sale.id,
            referenceNo: saleNo,
            reason: `Sold via Pharmacy POS (${saleNo})`,
            createdByName: auth.ctx.actor.name,
          });
        }

        if (appliedPaid > 0) {
          await tx.payment.create({
            data: {
              organizationId,
              branchId,
              orderId: null,
              pharmacySaleId: sale.id,
              amount: appliedPaid,
              method: data.paymentMethod,
              reference: data.reference,
              receivedByName: auth.ctx.actor.name,
            },
          });
        }

        return { sale, changeAmount };
      },
      { maxWait: 10000, timeout: 30000 },
    );

    if (result.error) return result.error;
    return json(
      {
        id: result.sale.id,
        saleNo: result.sale.saleNo,
        total: Number(result.sale.total),
        paidAmount: Number(result.sale.paidAmount),
        changeAmount: result.changeAmount,
        message: `Sale ${result.sale.saleNo} completed.`,
      },
      201,
    );
  } catch (error) {
    return handleError(error, "Pharmacy sale create");
  }
}
