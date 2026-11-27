import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, authorityWhere } from "@/lib/scope";
import { fail, handleError, isUuid, json, money, opt, parseBody, positive, round2 } from "@/lib/http";
import { paymentStatusFor } from "@/lib/lab";
import { PHARMACY_METHOD_VALUES, recordStockMovement } from "@/lib/pharmacy";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    if (!isUuid(id)) return fail("Purchase not found.", 404);

    const purchase = await prisma.pharmacyPurchase.findFirst({
      where: { id, ...authorityWhere(auth.ctx.actor) },
      include: {
        supplier: true,
        branch: { select: { id: true, name: true, code: true, address: true, city: true, phone: true } },
        items: {
          include: {
            medicine: { select: { id: true, name: true, genericName: true, strength: true, unit: true } },
            batch: { select: { id: true, batchNumber: true, quantity: true, expiryDate: true } },
          },
        },
        returns: {
          orderBy: { createdAt: "desc" },
          include: { items: { include: { batch: { select: { batchNumber: true } }, purchaseItem: { include: { medicine: { select: { name: true } } } } } } },
        },
        supplierPayments: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!purchase) return fail("Purchase not found.", 404);
    return json(purchase);
  } catch (error) {
    return handleError(error, "Pharmacy purchase detail");
  }
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("finalize"),
    paidAmount: money.optional(),
    paymentMethod: z.enum(PHARMACY_METHOD_VALUES).optional(),
  }),
  z.object({
    action: z.literal("cancel"),
  }),
  z.object({
    action: z.literal("pay"),
    amount: positive,
    method: z.enum(PHARMACY_METHOD_VALUES).default("CASH"),
    reference: opt(100),
  }),
]);

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    if (!isUuid(id)) return fail("Purchase not found.", 404);
    const parsed = await parseBody(request, patchSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const found = await tx.pharmacyPurchase.findFirst({
        where: { id, ...authorityWhere(auth.ctx.actor) },
        select: { id: true },
      });
      if (!found) return { error: fail("Purchase not found.", 404) };
      await tx.$queryRaw`SELECT id FROM "PharmacyPurchase" WHERE id = ${id}::uuid FOR UPDATE`;

      const purchase = await tx.pharmacyPurchase.findUnique({ where: { id }, include: { items: true } });

      if (body.action === "finalize") {
        if (purchase.status === "CANCELLED") return { error: fail("Cancelled purchases cannot be finalized.", 409) };
        if (purchase.status === "FINALIZED" || purchase.stockApplied) {
          return { error: fail("This purchase is already finalized and stock was already added.", 409) };
        }
        const total = round2(Number(purchase.total));
        const paidAmount = body.paidAmount !== undefined ? round2(body.paidAmount) : round2(Number(purchase.paidAmount));
        if (paidAmount > total + 0.001) return { error: fail("Paid amount cannot exceed purchase total.", 400) };
        const method = body.paymentMethod || purchase.paymentMethod;

        for (const item of purchase.items) {
          const batch = await tx.medicineBatch.create({
            data: {
              organizationId: purchase.organizationId,
              branchId: purchase.branchId,
              medicineId: item.medicineId,
              batchNumber: item.batchNumber,
              expiryDate: item.expiryDate,
              purchasePrice: item.purchasePrice,
              salePrice: item.salePrice,
              initialQuantity: item.quantity,
              quantity: item.quantity,
              supplierId: purchase.supplierId,
              purchaseId: purchase.id,
            },
          });
          await tx.pharmacyPurchaseItem.update({ where: { id: item.id }, data: { batchId: batch.id } });
          await recordStockMovement(tx, {
            organizationId: purchase.organizationId,
            branchId: purchase.branchId,
            medicineId: item.medicineId,
            batchId: batch.id,
            type: "PURCHASE_IN",
            quantityChange: item.quantity,
            balanceBefore: 0,
            balanceAfter: item.quantity,
            referenceType: "PHARMACY_PURCHASE",
            referenceId: purchase.id,
            referenceNo: purchase.purchaseNo,
            reason: `Purchase ${purchase.purchaseNo} finalized`,
            createdByName: auth.ctx.actor.name,
          });
        }

        const due = round2(total - paidAmount);
        if (due > 0) {
          await tx.supplier.update({
            where: { id: purchase.supplierId },
            data: { pharmacyBalance: { increment: due } },
          });
        }
        if (paidAmount > 0) {
          await tx.pharmacySupplierPayment.create({
            data: {
              organizationId: purchase.organizationId,
              branchId: purchase.branchId,
              supplierId: purchase.supplierId,
              purchaseId: purchase.id,
              amount: paidAmount,
              method,
              notes: `Payment on finalizing ${purchase.purchaseNo}`,
              paidByName: auth.ctx.actor.name,
            },
          });
        }

        await tx.pharmacyPurchase.update({
          where: { id },
          data: {
            status: "FINALIZED",
            stockApplied: true,
            finalizedAt: new Date(),
            paidAmount,
            paymentMethod: method,
            paymentStatus: paymentStatusFor(total, paidAmount),
          },
        });
        return { message: "Purchase finalized and stock added." };
      }

      if (body.action === "cancel") {
        if (purchase.status === "FINALIZED" || purchase.stockApplied) {
          return { error: fail("Finalized purchases cannot be cancelled; use Purchase Return instead.", 409) };
        }
        if (purchase.status === "CANCELLED") return { error: fail("Purchase is already cancelled.", 409) };
        await tx.pharmacyPurchase.update({
          where: { id },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        });
        return { message: "Purchase cancelled." };
      }

      if (body.action === "pay") {
        if (purchase.status !== "FINALIZED") return { error: fail("Only finalized purchases can record supplier payments.", 409) };
        const amount = round2(body.amount);
        const netTotal = round2(Number(purchase.total) - Number(purchase.returnedAmount));
        const due = round2(Math.max(0, netTotal - Number(purchase.paidAmount)));
        if (amount > due + 0.001) return { error: fail(`Amount exceeds remaining balance (${due}).`, 400) };

        const newPaid = round2(Number(purchase.paidAmount) + amount);
        await tx.pharmacyPurchase.update({
          where: { id },
          data: { paidAmount: newPaid, paymentStatus: paymentStatusFor(netTotal, newPaid) },
        });
        await tx.pharmacySupplierPayment.create({
          data: {
            organizationId: purchase.organizationId,
            branchId: purchase.branchId,
            supplierId: purchase.supplierId,
            purchaseId: purchase.id,
            amount,
            method: body.method,
            reference: body.reference,
            paidByName: auth.ctx.actor.name,
          },
        });
        await tx.supplier.update({
          where: { id: purchase.supplierId },
          data: { pharmacyBalance: { decrement: amount } },
        });
        return { message: "Purchase payment recorded." };
      }
    });

    if (result.error) return result.error;
    return json({ message: result.message });
  } catch (error) {
    return handleError(error, "Pharmacy purchase update");
  }
}
