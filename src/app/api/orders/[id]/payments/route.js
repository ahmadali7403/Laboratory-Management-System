import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, authorityWhere } from "@/lib/scope";
import { fail, handleError, isUuid, json, opt, parseBody, positive, round2 } from "@/lib/http";
import { paymentStatusFor } from "@/lib/lab";

const schema = z.object({
  amount: positive,
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "ONLINE"]).default("CASH"),
  reference: opt(100),
});

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    if (!isUuid(id)) return fail("Order not found.", 404);
    const parsed = await parseBody(request, schema);
    if (parsed.error) return parsed.error;
    const amount = round2(parsed.data.amount);

    const result = await prisma.$transaction(async (tx) => {
      // Row lock: two cashiers can never overpay the same invoice at once.
      const found = await tx.labOrder.findFirst({ where: { id, ...authorityWhere(auth.ctx.actor) }, select: { id: true } });
      if (!found) return { error: fail("Order not found.", 404) };
      await tx.$queryRaw`SELECT id FROM "LabOrder" WHERE id = ${id}::uuid FOR UPDATE`;

      const order = await tx.labOrder.findUnique({
        where: { id },
        select: { id: true, organizationId: true, branchId: true, total: true, paidAmount: true, status: true },
      });
      if (order.status === "CANCELLED") return { error: fail("Cannot record a payment for a cancelled order.", 409) };
      const balance = round2(Number(order.total) - Number(order.paidAmount));
      if (amount > balance + 0.001) return { error: fail(`Payment exceeds the outstanding balance (${balance}).`, 400) };

      const payment = await tx.payment.create({
        data: {
          organizationId: order.organizationId,
          branchId: order.branchId,
          orderId: order.id,
          amount,
          method: parsed.data.method,
          reference: parsed.data.reference,
          receivedByName: auth.ctx.actor.name,
        },
      });
      const paid = round2(Number(order.paidAmount) + amount);
      await tx.labOrder.update({ where: { id }, data: { paidAmount: paid, paymentStatus: paymentStatusFor(order.total, paid) } });
      return { payment, paid };
    });
    if (result.error) return result.error;
    return json({ message: "Payment recorded.", payment: result.payment, paidAmount: result.paid }, 201);
  } catch (error) {
    return handleError(error, "Payment create");
  }
}
