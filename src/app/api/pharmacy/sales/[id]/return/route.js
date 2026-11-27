import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, authorityWhere } from "@/lib/scope";
import { fail, handleError, isUuid, json, money, opt, parseBody, positive, round2, uuid } from "@/lib/http";
import { nextNumber } from "@/lib/sequence";
import { PHARMACY_METHOD_VALUES, recordStockMovement } from "@/lib/pharmacy";

const schema = z.object({
  reason: opt(300),
  refundMethod: z.enum(PHARMACY_METHOD_VALUES).default("CASH"),
  refundAmount: money.optional(),
  items: z
    .array(z.object({ saleItemId: uuid, quantity: positive }))
    .min(1, "Select at least one medicine to return."),
});

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    if (!isUuid(id)) return fail("Sale not found.", 404);
    const parsed = await parseBody(request, schema);
    if (parsed.error) return parsed.error;

    const result = await prisma.$transaction(async (tx) => {
      const found = await tx.pharmacySale.findFirst({
        where: { id, ...authorityWhere(auth.ctx.actor) },
        select: { id: true },
      });
      if (!found) return { error: fail("Sale not found.", 404) };
      await tx.$queryRaw`SELECT id FROM "PharmacySale" WHERE id = ${id}::uuid FOR UPDATE`;

      const sale = await tx.pharmacySale.findUnique({ where: { id }, include: { items: true } });
      if (sale.status === "CANCELLED" || sale.status === "RETURNED") {
        return { error: fail(`Sale is already ${sale.status.toLowerCase()}.`, 409) };
      }

      const itemMap = new Map(sale.items.map((i) => [i.id, i]));
      const reqItems = [];
      for (const r of parsed.data.items) {
        const si = itemMap.get(r.saleItemId);
        if (!si) return { error: fail("Invalid sale item.", 400) };
        const returnable = round2(Number(si.quantity) - Number(si.returnedQuantity));
        const qty = round2(r.quantity);
        if (qty > returnable + 0.001) {
          return { error: fail(`Return quantity (${qty}) exceeds remaining sold quantity (${returnable}) for ${si.medicineName}.`, 400) };
        }
        reqItems.push({ si, qty });
      }

      const batchIds = [...new Set(reqItems.map((x) => x.si.batchId))].sort();
      for (const bid of batchIds) {
        await tx.$queryRaw`SELECT id FROM "MedicineBatch" WHERE id = ${bid}::uuid FOR UPDATE`;
      }

      let returnTotal = 0;
      const lines = [];
      for (const { si, qty } of reqItems) {
        const batch = await tx.medicineBatch.findUnique({ where: { id: si.batchId } });
        const prev = round2(Number(batch.quantity));
        const nextStock = round2(prev + qty);
        const effUnit = Number(si.quantity) > 0 ? round2(Number(si.lineTotal) / Number(si.quantity)) : Number(si.unitPrice);
        const lineTotal = round2(qty * effUnit);
        returnTotal = round2(returnTotal + lineTotal);

        await tx.medicineBatch.update({ where: { id: batch.id }, data: { quantity: nextStock } });
        await tx.pharmacySaleItem.update({
          where: { id: si.id },
          data: { returnedQuantity: round2(Number(si.returnedQuantity) + qty) },
        });
        await recordStockMovement(tx, {
          organizationId: sale.organizationId,
          branchId: sale.branchId,
          medicineId: si.medicineId,
          batchId: batch.id,
          type: "SALE_RETURN_IN",
          quantityChange: qty,
          balanceBefore: prev,
          balanceAfter: nextStock,
          referenceType: "PHARMACY_SALE_RETURN",
          referenceId: sale.id,
          referenceNo: sale.saleNo,
          reason: parsed.data.reason || `Return on ${sale.saleNo}`,
          createdByName: auth.ctx.actor.name,
        });
        lines.push({ saleItemId: si.id, batchId: batch.id, quantity: qty, unitPrice: effUnit, lineTotal });
      }

      const maxRefundable = round2(Math.max(0, Number(sale.paidAmount) - Number(sale.refundedAmount)));
      const refundAmount = round2(Math.min(maxRefundable, parsed.data.refundAmount ?? returnTotal));

      const returnNo = await nextNumber(tx, sale.organizationId, "pharmacy_sale_return", "PSR");
      const ret = await tx.pharmacySaleReturn.create({
        data: {
          organizationId: sale.organizationId,
          branchId: sale.branchId,
          returnNo,
          saleId: sale.id,
          total: returnTotal,
          refundAmount,
          reason: parsed.data.reason,
          createdByName: auth.ctx.actor.name,
          items: { create: lines },
        },
      });

      if (refundAmount > 0) {
        await tx.payment.create({
          data: {
            organizationId: sale.organizationId,
            branchId: sale.branchId,
            orderId: null,
            pharmacySaleId: sale.id,
            amount: -refundAmount,
            method: parsed.data.refundMethod,
            reference: `Return ${returnNo} (${sale.saleNo})`,
            receivedByName: auth.ctx.actor.name,
          },
        });
      }

      const updatedItems = await tx.pharmacySaleItem.findMany({ where: { saleId: sale.id } });
      const allReturned = updatedItems.every((i) => round2(Number(i.quantity) - Number(i.returnedQuantity)) <= 0.001);

      await tx.pharmacySale.update({
        where: { id: sale.id },
        data: {
          status: allReturned ? "RETURNED" : "PARTIAL_RETURN",
          refundedAmount: round2(Number(sale.refundedAmount) + refundAmount),
        },
      });

      return { ret };
    });

    if (result.error) return result.error;
    return json({ id: result.ret.id, returnNo: result.ret.returnNo, message: "Sale return processed and stock restored." }, 201);
  } catch (error) {
    return handleError(error, "Pharmacy sale return");
  }
}
