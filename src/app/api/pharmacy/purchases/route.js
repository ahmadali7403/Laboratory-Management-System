import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, resolveWriteTarget, scopeWhere } from "@/lib/scope";
import { fail, handleError, isUuid, json, money, opt, optUuid, paging, parseBody, positive, req, round2, uuid } from "@/lib/http";
import { nextNumber } from "@/lib/sequence";
import { paymentStatusFor } from "@/lib/lab";
import { PHARMACY_METHOD_VALUES, recordStockMovement } from "@/lib/pharmacy";

export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const sp = new URL(request.url).searchParams;
    const { page, pageSize, skip, take } = paging(sp, 20);
    const q = (sp.get("q") || "").trim().slice(0, 100);
    const status = sp.get("status");
    const paymentStatus = sp.get("paymentStatus");
    const supplierId = sp.get("supplierId");

    const and = [scopeWhere(auth.ctx.scope)];
    if (["DRAFT", "ORDERED", "FINALIZED", "CANCELLED"].includes(status)) and.push({ status });
    if (["UNPAID", "PARTIAL", "PAID"].includes(paymentStatus)) and.push({ paymentStatus });
    if (isUuid(supplierId)) and.push({ supplierId });
    if (q) {
      and.push({
        OR: [
          { purchaseNo: { contains: q, mode: "insensitive" } },
          { invoiceNo: { contains: q, mode: "insensitive" } },
          { supplier: { name: { contains: q, mode: "insensitive" } } },
        ],
      });
    }
    const where = { AND: and };
    const [items, total] = await Promise.all([
      prisma.pharmacyPurchase.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
          branch: { select: { id: true, name: true } },
          _count: { select: { items: true } },
          items: { include: { medicine: { select: { id: true, name: true, unit: true, strength: true } } } },
        },
      }),
      prisma.pharmacyPurchase.count({ where }),
    ]);
    return json({ items, total, page, pageSize });
  } catch (error) {
    return handleError(error, "Pharmacy purchases list");
  }
}

const itemSchema = z.object({
  medicineId: uuid,
  batchNumber: req(1, 60, "Batch number"),
  expiryDate: z.coerce.date({ message: "Valid expiry date is required." }),
  quantity: positive,
  purchasePrice: money,
  salePrice: money,
});

const createSchema = z.object({
  branchId: optUuid,
  supplierId: uuid,
  invoiceNo: opt(80),
  purchaseDate: z.coerce.date({ message: "Valid purchase date is required." }),
  discount: money.default(0),
  additionalCharges: money.default(0),
  paidAmount: money.default(0),
  paymentMethod: z.enum(PHARMACY_METHOD_VALUES).default("CASH"),
  notes: opt(500),
  finalizeNow: z.boolean().default(false),
  status: z.enum(["DRAFT", "ORDERED"]).default("ORDERED"),
  items: z.array(itemSchema).min(1, "Add at least one medicine.").max(100),
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

    const supplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, organizationId, isActive: true, OR: [{ branchId: null }, { branchId }] },
      select: { id: true },
    });
    if (!supplier) return fail("Supplier not found.", 404);

    const medIds = [...new Set(data.items.map((i) => i.medicineId))];
    const meds = await prisma.medicine.findMany({
      where: { id: { in: medIds }, organizationId, branchId },
      select: { id: true, defaultPurchasePrice: true, defaultSalePrice: true },
    });
    if (meds.length !== medIds.length) return fail("One or more medicines were not found in this branch.", 404);

    const subtotal = round2(data.items.reduce((s, i) => s + round2(i.quantity * i.purchasePrice), 0));
    const discount = round2(data.discount);
    if (discount > subtotal) return fail("Discount cannot exceed purchase subtotal.", 400);
    const additionalCharges = round2(data.additionalCharges);
    const total = round2(subtotal - discount + additionalCharges);
    const paidAmount = round2(data.paidAmount);
    if (paidAmount > total + 0.001) return fail("Paid amount cannot exceed purchase total.", 400);

    const finalizeNow = Boolean(data.finalizeNow);
    const purchaseStatus = finalizeNow ? "FINALIZED" : data.status;

    const purchase = await prisma.$transaction(async (tx) => {
      const purchaseNo = await nextNumber(tx, organizationId, "pharmacy_purchase", "PPUR");
      const created = await tx.pharmacyPurchase.create({
        data: {
          organizationId,
          branchId,
          purchaseNo,
          supplierId: supplier.id,
          invoiceNo: data.invoiceNo,
          status: purchaseStatus,
          paymentStatus: paymentStatusFor(total, paidAmount),
          subtotal,
          discount,
          additionalCharges,
          total,
          paidAmount,
          paymentMethod: data.paymentMethod,
          purchaseDate: data.purchaseDate,
          stockApplied: finalizeNow,
          finalizedAt: finalizeNow ? new Date() : null,
          notes: data.notes,
          createdByName: auth.ctx.actor.name,
        },
      });

      for (const item of data.items) {
        const lineTotal = round2(item.quantity * item.purchasePrice);
        let batchId = null;

        if (finalizeNow) {
          const batch = await tx.medicineBatch.create({
            data: {
              organizationId,
              branchId,
              medicineId: item.medicineId,
              batchNumber: item.batchNumber,
              expiryDate: item.expiryDate,
              purchasePrice: round2(item.purchasePrice),
              salePrice: round2(item.salePrice),
              initialQuantity: round2(item.quantity),
              quantity: round2(item.quantity),
              supplierId: supplier.id,
              purchaseId: created.id,
            },
          });
          batchId = batch.id;
          await recordStockMovement(tx, {
            organizationId,
            branchId,
            medicineId: item.medicineId,
            batchId: batch.id,
            type: "PURCHASE_IN",
            quantityChange: item.quantity,
            balanceBefore: 0,
            balanceAfter: item.quantity,
            referenceType: "PHARMACY_PURCHASE",
            referenceId: created.id,
            referenceNo: purchaseNo,
            reason: `Purchase ${purchaseNo} finalized`,
            createdByName: auth.ctx.actor.name,
          });
        }

        await tx.pharmacyPurchaseItem.create({
          data: {
            purchaseId: created.id,
            medicineId: item.medicineId,
            batchId,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            quantity: round2(item.quantity),
            purchasePrice: round2(item.purchasePrice),
            salePrice: round2(item.salePrice),
            lineTotal,
          },
        });
      }

      if (finalizeNow) {
        const due = round2(total - paidAmount);
        if (due > 0) {
          await tx.supplier.update({
            where: { id: supplier.id },
            data: { pharmacyBalance: { increment: due } },
          });
        }
        if (paidAmount > 0) {
          await tx.pharmacySupplierPayment.create({
            data: {
              organizationId,
              branchId,
              supplierId: supplier.id,
              purchaseId: created.id,
              amount: paidAmount,
              method: data.paymentMethod,
              notes: `Initial payment on ${purchaseNo}`,
              paidByName: auth.ctx.actor.name,
            },
          });
        }
      }

      return created;
    });

    return json({ id: purchase.id, purchaseNo: purchase.purchaseNo, message: finalizeNow ? "Purchase finalized and stock updated." : "Purchase saved." }, 201);
  } catch (error) {
    return handleError(error, "Pharmacy purchase create");
  }
}
