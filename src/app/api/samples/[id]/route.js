import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, authorityWhere } from "@/lib/scope";
import { fail, handleError, isUuid, json, parseBody } from "@/lib/http";
import { recomputeOrderStatus } from "@/lib/lab";
import { notify } from "@/lib/notify";

const schema = z.object({
  action: z.enum(["collect", "receive", "reject", "reset"]),
  reason: z.string().trim().max(300).optional(),
});

const TRANSITIONS = {
  collect: { from: ["PENDING"], to: "COLLECTED" },
  receive: { from: ["COLLECTED"], to: "RECEIVED" },
  reject: { from: ["PENDING", "COLLECTED", "RECEIVED"], to: "REJECTED" },
  reset: { from: ["REJECTED"], to: "PENDING" },
};

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    if (!isUuid(id)) return fail("Sample not found.", 404);
    const parsed = await parseBody(request, schema);
    if (parsed.error) return parsed.error;
    const { action, reason } = parsed.data;
    if (action === "reject" && !reason) return fail("Please provide a rejection reason.", 400);

    const result = await prisma.$transaction(async (tx) => {
      const sample = await tx.sample.findFirst({
        where: { id, order: authorityWhere(auth.ctx.actor) },
        include: { order: { select: { id: true, orderNo: true, status: true, organizationId: true, branchId: true } } },
      });
      if (!sample) return { error: fail("Sample not found.", 404) };
      if (sample.order.status === "CANCELLED") return { error: fail("This order is cancelled.", 409) };
      const rule = TRANSITIONS[action];
      if (!rule.from.includes(sample.status)) return { error: fail(`Cannot ${action} a sample that is ${sample.status.toLowerCase()}.`, 409) };

      const data = { status: rule.to };
      if (action === "collect") Object.assign(data, { collectedAt: new Date(), collectedByName: auth.ctx.actor.name, rejectionReason: null });
      if (action === "reject") data.rejectionReason = reason;
      if (action === "reset") Object.assign(data, { rejectionReason: null, collectedAt: null, collectedByName: null });

      await tx.sample.update({ where: { id }, data });
      if (action === "reject" || action === "reset") {
        // A rejected sample invalidates entered results that depend on it.
        await tx.labOrderItem.updateMany({
          where: { sampleId: id, resultStatus: { not: "PENDING" } },
          data: { resultStatus: "PENDING", resultValue: null, verifiedAt: null, verifiedByName: null, enteredAt: null, enteredByName: null },
        });
        await tx.labResult.updateMany({ where: { orderItem: { sampleId: id } }, data: { value: null, flag: "NORMAL" } });
      }
      await recomputeOrderStatus(tx, sample.order.id);
      if (action === "reject") {
        await notify(tx, {
          organizationId: sample.order.organizationId,
          branchId: sample.order.branchId,
          type: "SAMPLE_REJECTED",
          title: "Sample rejected",
          message: `${sample.sampleNo} (${sample.order.orderNo}) was rejected: ${reason}`,
          link: "/samples",
        });
      }
      return { ok: true };
    });
    if (result.error) return result.error;
    return json({ message: "Sample updated." });
  } catch (error) {
    return handleError(error, "Sample update");
  }
}
