import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, authorityWhere } from "@/lib/scope";
import { fail, handleError, isUuid, json, parseBody } from "@/lib/http";

const detailInclude = {
  patient: true,
  branch: { select: { id: true, name: true, code: true } },
  items: { orderBy: { createdAt: "asc" }, include: { sample: { select: { id: true, sampleNo: true, status: true } } } },
  samples: { orderBy: { createdAt: "asc" } },
  payments: { orderBy: { createdAt: "desc" } },
};

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    if (!isUuid(id)) return fail("Order not found.", 404);
    const order = await prisma.labOrder.findFirst({ where: { id, ...authorityWhere(auth.ctx.actor) }, include: detailInclude });
    if (!order) return fail("Order not found.", 404);
    return json(order);
  } catch (error) {
    return handleError(error, "Order detail");
  }
}

const patchSchema = z.object({ action: z.literal("cancel"), reason: z.string().trim().max(300).optional() });

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    if (!isUuid(id)) return fail("Order not found.", 404);
    const parsed = await parseBody(request, patchSchema);
    if (parsed.error) return parsed.error;

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.labOrder.findFirst({
        where: { id, ...authorityWhere(auth.ctx.actor) },
        select: { id: true, status: true, paidAmount: true, orderNo: true, organizationId: true, branchId: true, items: { select: { resultStatus: true } } },
      });
      if (!order) return { error: fail("Order not found.", 404) };
      if (order.status === "CANCELLED") return { error: fail("Order is already cancelled.", 409) };
      if (order.status === "COMPLETED") return { error: fail("A completed order cannot be cancelled.", 409) };
      if (Number(order.paidAmount) > 0) return { error: fail("This order has payments recorded. Payments must be settled before cancelling.", 409) };
      if (order.items.some((i) => i.resultStatus !== "PENDING")) return { error: fail("Results have already been entered for this order.", 409) };
      await tx.labOrder.update({
        where: { id },
        data: { status: "CANCELLED", cancelledAt: new Date(), notes: parsed.data.reason ? `Cancelled: ${parsed.data.reason}` : undefined },
      });
      return { ok: true };
    });
    if (result.error) return result.error;
    return json({ message: "Order cancelled." });
  } catch (error) {
    return handleError(error, "Order cancel");
  }
}
