import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, authorityWhere } from "@/lib/scope";
import { fail, handleError, isUuid, json, opt, parseBody, round2 } from "@/lib/http";
import { recordStockMovement } from "@/lib/pharmacy";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    if (!isUuid(id)) return fail("Sale not found.", 404);

    const sale = await prisma.pharmacySale.findFirst({
      where: { id, ...authorityWhere(auth.ctx.actor) },
      include: {
        patient: { select: { id: true, name: true, mrn: true, phone: true } },
        branch: { select: { id: true, name: true, code: true, address: true, city: true, phone: true, organization: { select: { name: true, phone: true } } } },
        items: { include: { medicine: { select: { unit: true } } } },
        payments: { orderBy: { createdAt: "desc" } },
        returns: {
          orderBy: { createdAt: "desc" },
          include: { items: { include: { saleItem: { select: { medicineName: true, batchNumber: true } } } } },
        },
      },
    });
    if (!sale) return fail("Sale not found.", 404);
    return json(sale);
  } catch (error) {
    return handleError(error, "Pharmacy sale detail");
  }
}

const patchSchema = z.object({
  action: z.literal("cancel"),
  reason: opt(300),
});

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    if (!isUuid(id)) return fail("Sale not found.", 404);
    const parsed = await parseBody(request, patchSchema);
    if (parsed.error) return parsed.error;

    const result = await prisma.$transaction(async (tx) => {
      const found = await tx.pharmacySale.findFirst({
        where: { id, ...authorityWhere(auth.ctx.actor) },
        select: { id: true },
      });
      if (!found) return { error: fail("Sale not found.", 404) };
      await tx.$queryRaw`SELECT id FROM "PharmacySale" WHERE id = ${id}::uuid FOR UPDATE`;

      const sale = await tx.pharmacySale.findUnique({ where: { id }, include: { items: true } });
      if (sale.status === "CANCELLED") return { error: fail("Sale is already cancelled.", 409) };
      if (sale.status === "RETURNED") return { error: fail("Fully returned sale cannot be cancelled.", 409) };

      const batchIds = [...new Set(sale.items.map((i) => i.batchId))].sort();
      for (const bid of batchIds) {
        await tx.$queryRaw`SELECT id FROM "MedicineBatch" WHERE id = ${bid}::uuid FOR UPDATE`;
      }

      for (const item of sale.items) {
        const restoreQty = round2(Number(item.quantity) - Number(item.returnedQuantity));
        if (restoreQty <= 0) continue;
        const batch = await tx.medicineBatch.findUnique({ where: { id: item.batchId } });
        const prev = round2(Number(batch.quantity));
        const nextStock = round2(prev + restoreQty);
        await tx.medicineBatch.update({ where: { id: batch.id }, data: { quantity: nextStock } });
        await recordStockMovement(tx, {
          organizationId: sale.organizationId,
          branchId: sale.branchId,
          medicineId: item.medicineId,
          batchId: batch.id,
          type: "SALE_CANCEL_RESTORE",
          quantityChange: restoreQty,
          balanceBefore: prev,
          balanceAfter: nextStock,
          referenceType: "PHARMACY_SALE",
          referenceId: sale.id,
          referenceNo: sale.saleNo,
          reason: parsed.data.reason ? `Sale cancelled: ${parsed.data.reason}` : `Sale ${sale.saleNo} cancelled`,
          createdByName: auth.ctx.actor.name,
        });
      }

      const netPaid = round2(Math.max(0, Number(sale.paidAmount) - Number(sale.refundedAmount)));
      if (netPaid > 0) {
        await tx.payment.create({
          data: {
            organizationId: sale.organizationId,
            branchId: sale.branchId,
            orderId: null,
            pharmacySaleId: sale.id,
            amount: -netPaid,
            method: "CASH",
            reference: `Cancel refund ${sale.saleNo}`,
            receivedByName: auth.ctx.actor.name,
          },
        });
      }

      await tx.pharmacySale.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: parsed.data.reason,
          refundedAmount: round2(Number(sale.refundedAmount) + netPaid),
        },
      });
      return { ok: true };
    });

    if (result.error) return result.error;
    return json({ message: "Sale cancelled and stock restored." });
  } catch (error) {
    return handleError(error, "Pharmacy sale cancel");
  }
}
