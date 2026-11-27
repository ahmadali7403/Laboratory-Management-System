import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, authorityWhere } from "@/lib/scope";
import { fail, handleError, isUuid, json, opt, parseBody, positive, round2 } from "@/lib/http";
import { paymentStatusFor } from "@/lib/lab";
import { PHARMACY_METHOD_VALUES } from "@/lib/pharmacy";

const schema = z.object({
  amount: positive,
  method: z.enum(PHARMACY_METHOD_VALUES).default("CASH"),
  reference: opt(100),
});

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    if (!isUuid(id)) return fail("Sale not found.", 404);
    const parsed = await parseBody(request, schema);
    if (parsed.error) return parsed.error;
    const amount = round2(parsed.data.amount);

    const result = await prisma.$transaction(async (tx) => {
      const found = await tx.pharmacySale.findFirst({
        where: { id, ...authorityWhere(auth.ctx.actor) },
        select: { id: true },
      });
      if (!found) return { error: fail("Sale not found.", 404) };
      await tx.$queryRaw`SELECT id FROM "PharmacySale" WHERE id = ${id}::uuid FOR UPDATE`;

      const sale = await tx.pharmacySale.findUnique({ where: { id } });
      if (sale.status === "CANCELLED" || sale.status === "RETURNED") {
        return { error: fail("Cannot record a payment for a cancelled or returned sale.", 409) };
      }
      const balance = round2(Number(sale.total) - Number(sale.paidAmount));
      if (amount > balance + 0.001) {
        return { error: fail(`Payment exceeds the outstanding balance (${balance}).`, 400) };
      }

      const payment = await tx.payment.create({
        data: {
          organizationId: sale.organizationId,
          branchId: sale.branchId,
          orderId: null,
          pharmacySaleId: sale.id,
          amount,
          method: parsed.data.method,
          reference: parsed.data.reference,
          receivedByName: auth.ctx.actor.name,
        },
      });
      const paid = round2(Number(sale.paidAmount) + amount);
      await tx.pharmacySale.update({
        where: { id },
        data: { paidAmount: paid, paymentStatus: paymentStatusFor(sale.total, paid) },
      });
      return { payment, paid };
    });

    if (result.error) return result.error;
    return json({ message: "Payment recorded.", payment: result.payment, paidAmount: result.paid }, 201);
  } catch (error) {
    return handleError(error, "Pharmacy sale payment");
  }
}
