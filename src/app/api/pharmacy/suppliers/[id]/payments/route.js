import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, authorityWhere, isBranchBound, resolveWriteTarget } from "@/lib/scope";
import { fail, handleError, isUuid, json, opt, optUuid, parseBody, positive, round2 } from "@/lib/http";
import { paymentStatusFor } from "@/lib/lab";
import { PHARMACY_METHOD_VALUES } from "@/lib/pharmacy";

const schema = z.object({
  branchId: optUuid,
  purchaseId: optUuid,
  amount: positive,
  method: z.enum(PHARMACY_METHOD_VALUES).default("CASH"),
  reference: opt(100),
  notes: opt(300),
});

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    if (!isUuid(id)) return fail("Supplier not found.", 404);

    const parsed = await parseBody(request, schema);
    if (parsed.error) return parsed.error;
    const data = parsed.data;
    const amount = round2(data.amount);

    const resolved = await resolveWriteTarget(auth.ctx, data, { branchRequired: true });
    if (resolved.error) return resolved.error;
    const { organizationId, branchId } = resolved.target;

    const actor = auth.ctx.actor;
    const result = await prisma.$transaction(async (tx) => {
      const supWhere = {
        id,
        organizationId,
        ...(isBranchBound(actor) ? { OR: [{ branchId: null }, { branchId: actor.branchId }] } : {}),
      };
      const found = await tx.supplier.findFirst({ where: supWhere, select: { id: true } });
      if (!found) return { error: fail("Supplier not found.", 404) };
      await tx.$queryRaw`SELECT id FROM "Supplier" WHERE id = ${id}::uuid FOR UPDATE`;

      if (data.purchaseId) {
        const pur = await tx.pharmacyPurchase.findFirst({
          where: { id: data.purchaseId, supplierId: id, ...authorityWhere(actor) },
          select: { id: true },
        });
        if (!pur) return { error: fail("Purchase not found for this supplier.", 404) };
        await tx.$queryRaw`SELECT id FROM "PharmacyPurchase" WHERE id = ${data.purchaseId}::uuid FOR UPDATE`;
        const pRow = await tx.pharmacyPurchase.findUnique({ where: { id: data.purchaseId } });
        if (pRow.status !== "FINALIZED") return { error: fail("Payments can only be applied to finalized purchases.", 409) };
        const netTotal = round2(Number(pRow.total) - Number(pRow.returnedAmount));
        const due = round2(Math.max(0, netTotal - Number(pRow.paidAmount)));
        if (amount > due + 0.001) return { error: fail(`Amount exceeds purchase balance (${due}).`, 400) };
        const newPaid = round2(Number(pRow.paidAmount) + amount);
        await tx.pharmacyPurchase.update({
          where: { id: pRow.id },
          data: { paidAmount: newPaid, paymentStatus: paymentStatusFor(netTotal, newPaid) },
        });
      }

      const payment = await tx.pharmacySupplierPayment.create({
        data: {
          organizationId,
          branchId,
          supplierId: id,
          purchaseId: data.purchaseId || null,
          amount,
          method: data.method,
          reference: data.reference,
          notes: data.notes,
          paidByName: actor.name,
        },
      });
      const sup = await tx.supplier.update({
        where: { id },
        data: { pharmacyBalance: { decrement: amount } },
        select: { pharmacyBalance: true },
      });
      return { payment, balance: Number(sup.pharmacyBalance) };
    });

    if (result.error) return result.error;
    return json({ id: result.payment.id, pharmacyBalance: result.balance, message: "Supplier payment recorded." }, 201);
  } catch (error) {
    return handleError(error, "Supplier payment");
  }
}
