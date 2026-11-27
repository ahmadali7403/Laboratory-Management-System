import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, authorityWhere } from "@/lib/scope";
import { fail, handleError, isUuid, json, opt, parseBody, positive, round2, uuid } from "@/lib/http";
import { nextNumber } from "@/lib/sequence";
import { paymentStatusFor } from "@/lib/lab";
import { recordStockMovement } from "@/lib/pharmacy";

const schema = z.object({
  reason: opt(300),
  items: z
    .array(z.object({ purchaseItemId: uuid, quantity: positive }))
    .min(1, "Select at least one item to return."),
});

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    if (!isUuid(id)) return fail("Purchase not found.", 404);
    const parsed = await parseBody(request, schema);
    if (parsed.error) return parsed.error;

    const result = await prisma.$transaction(async (tx) => {
      const found = await tx.pharmacyPurchase.findFirst({
        where: { id, ...authorityWhere(auth.ctx.actor) },
        select: { id: true },
      });
      if (!found) return { error: fail("Purchase not found.", 404) };
      await tx.$queryRaw`SELECT id FROM "PharmacyPurchase" WHERE id = ${id}::uuid FOR UPDATE`;

      const purchase = await tx.pharmacyPurchase.findUnique({
        where: { id },
        include: { items: true },
      });
      if (purchase.status !== "FINALIZED" || !purchase.stockApplied) {
        return { error: fail("Only finalized purchases can be returned.", 409) };
      }

      const itemMap = new Map(purchase.items.map((i) => [i.id, i]));
      const reqItems = [];
      for (const reqItem of parsed.data.items) {
        const pi = itemMap.get(reqItem.purchaseItemId);
        if (!pi || !pi.batchId) return { error: fail("Invalid purchase item selected.", 400) };
        const returnable = round2(Number(pi.quantity) - Number(pi.returnedQuantity));
        const qty = round2(reqItem.quantity);
        if (qty > returnable + 0.001) {
          return { error: fail(`Return quantity (${qty}) exceeds returnable quantity (${returnable}).`, 400) };
        }
        reqItems.push({ pi, qty });
      }

      const batchIds = [...new Set(reqItems.map((x) => x.pi.batchId))].sort();
      for (const bid of batchIds) {
        await tx.$queryRaw`SELECT id FROM "MedicineBatch" WHERE id = ${bid}::uuid FOR UPDATE`;
      }

      let returnTotal = 0;
      const lines = [];
      for (const { pi, qty } of reqItems) {
        const batch = await tx.medicineBatch.findUnique({ where: { id: pi.batchId } });
        const prev = round2(Number(batch.quantity));
        if (qty > prev + 0.001) {
          return { error: fail(`Batch ${batch.batchNumber} only has ${prev} in stock to return.`, 409) };
        }
        const nextStock = round2(prev - qty);
        const unitPrice = round2(Number(pi.purchasePrice));
        const lineTotal = round2(qty * unitPrice);
        returnTotal = round2(returnTotal + lineTotal);

        await tx.medicineBatch.update({ where: { id: batch.id }, data: { quantity: nextStock } });
        await tx.pharmacyPurchaseItem.update({
          where: { id: pi.id },
          data: { returnedQuantity: round2(Number(pi.returnedQuantity) + qty) },
        });
        await recordStockMovement(tx, {
          organizationId: purchase.organizationId,
          branchId: purchase.branchId,
          medicineId: pi.medicineId,
          batchId: batch.id,
          type: "PURCHASE_RETURN_OUT",
          quantityChange: -qty,
          balanceBefore: prev,
          balanceAfter: nextStock,
          referenceType: "PHARMACY_PURCHASE_RETURN",
          referenceId: purchase.id,
          referenceNo: purchase.purchaseNo,
          reason: parsed.data.reason || `Return on ${purchase.purchaseNo}`,
          createdByName: auth.ctx.actor.name,
        });
        lines.push({ purchaseItemId: pi.id, batchId: batch.id, quantity: qty, unitPrice, lineTotal });
      }

      const returnNo = await nextNumber(tx, purchase.organizationId, "pharmacy_purchase_return", "PPR");
      const ret = await tx.pharmacyPurchaseReturn.create({
        data: {
          organizationId: purchase.organizationId,
          branchId: purchase.branchId,
          returnNo,
          purchaseId: purchase.id,
          supplierId: purchase.supplierId,
          total: returnTotal,
          reason: parsed.data.reason,
          createdByName: auth.ctx.actor.name,
          items: { create: lines },
        },
      });

      const newReturnedAmount = round2(Number(purchase.returnedAmount) + returnTotal);
      const netTotal = round2(Math.max(0, Number(purchase.total) - newReturnedAmount));
      await tx.pharmacyPurchase.update({
        where: { id: purchase.id },
        data: {
          returnedAmount: newReturnedAmount,
          paymentStatus: paymentStatusFor(netTotal, Number(purchase.paidAmount)),
        },
      });
      await tx.supplier.update({
        where: { id: purchase.supplierId },
        data: { pharmacyBalance: { decrement: returnTotal } },
      });

      return { ret };
    });

    if (result.error) return result.error;
    return json({ id: result.ret.id, returnNo: result.ret.returnNo, message: "Purchase return processed and stock updated." }, 201);
  } catch (error) {
    return handleError(error, "Pharmacy purchase return");
  }
}
