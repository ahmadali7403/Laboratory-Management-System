import { hasModule } from "@/lib/permissions";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, authorityWhere } from "@/lib/scope";
import { fail, handleError, isUuid, json, parseBody, uuid } from "@/lib/http";
import { SAMPLE_OK, computeFlag, recomputeOrderStatus, refRangeText } from "@/lib/lab";
import { notify } from "@/lib/notify";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("enter"),
    resultValue: z.string().trim().max(500).optional(),
    values: z
      .array(z.object({ id: uuid, value: z.string().trim().max(300), flag: z.enum(["NORMAL", "LOW", "HIGH", "CRITICAL", "ABNORMAL"]).nullish() }))
      .max(200)
      .optional(),
    unit: z.string().trim().max(30).nullish(),
    flag: z.enum(["NORMAL", "LOW", "HIGH", "CRITICAL", "ABNORMAL"]).optional(),
    comments: z.string().trim().max(500).nullish(),
  }),
  z.object({ action: z.literal("verify") }),
  z.object({ action: z.literal("reopen") }),
]);

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    if (!isUuid(id)) return fail("Result not found.", 404);
    const parsed = await parseBody(request, schema);
    if (parsed.error) return parsed.error;
    const input = parsed.data;
    const who = auth.ctx.actor;
    if (who.role === "STAFF" && !hasModule(who.permissions, input.action === "enter" ? "results" : "verification", true))
      return fail("You do not have permission to do this.", 403);

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.labOrderItem.findFirst({
        where: { id, order: authorityWhere(auth.ctx.actor) },
        include: {
          test: true,
          results: true,
          sample: { select: { status: true } },
          order: { select: { id: true, orderNo: true, status: true, organizationId: true, branchId: true, patient: { select: { name: true } } } },
        },
      });
      if (!item) return { error: fail("Result not found.", 404) };
      if (item.order.status === "CANCELLED") return { error: fail("This order is cancelled.", 409) };
      if (!item.sample || !SAMPLE_OK.includes(item.sample.status)) return { error: fail("The sample has not been collected yet.", 409) };

      if (input.action === "enter") {
        if (item.resultStatus === "VERIFIED") return { error: fail("Verified results are locked. Re-open the result to edit it.", 409) };

        if (item.results.length > 0) {
          // Panel test (CBC, LFT ...): every parameter needs a value.
          const byId = new Map(item.results.map((r) => [r.id, r]));
          const sent = new Map((input.values || []).map((v) => [v.id, v]));
          for (const id of sent.keys()) if (!byId.has(id)) return { error: fail("Invalid parameter in request.", 400) };
          for (const r of item.results) {
            if (!sent.get(r.id)?.value) return { error: fail(`Please enter a value for ${r.name}.`, 400) };
          }
          for (const r of item.results) {
            const v = sent.get(r.id);
            const flag = v.flag || computeFlag(v.value, r, "NORMAL");
            await tx.labResult.update({ where: { id: r.id }, data: { value: v.value, flag } });
          }
          await tx.labOrderItem.update({
            where: { id },
            data: {
              resultValue: null, comments: input.comments || null, resultStatus: "ENTERED",
              enteredByName: auth.ctx.actor.name, enteredAt: new Date(), verifiedByName: null, verifiedAt: null,
            },
          });
        } else {
          if (!input.resultValue) return { error: fail("Result value is required.", 400) };
          const flag = input.flag && !/^-?[\d.,\s]+$/.test(input.resultValue)
            ? input.flag
            : computeFlag(input.resultValue, item.test, input.flag || "NORMAL");
          await tx.labOrderItem.update({
            where: { id },
            data: {
              resultValue: input.resultValue,
              unit: input.unit || item.test.unit,
              refRange: refRangeText(item.test),
              flag,
              comments: input.comments || null,
              resultStatus: "ENTERED",
              enteredByName: auth.ctx.actor.name,
              enteredAt: new Date(),
              verifiedByName: null,
              verifiedAt: null,
            },
          });
        }
      } else if (input.action === "verify") {
        if (item.resultStatus !== "ENTERED") return { error: fail("Only entered results can be verified.", 409) };
        await tx.labOrderItem.update({
          where: { id },
          data: { resultStatus: "VERIFIED", verifiedByName: auth.ctx.actor.name, verifiedAt: new Date() },
        });
      } else {
        if (item.resultStatus !== "VERIFIED") return { error: fail("Only verified results can be re-opened.", 409) };
        await tx.labOrderItem.update({
          where: { id },
          data: { resultStatus: "ENTERED", verifiedByName: null, verifiedAt: null },
        });
      }

      const status = await recomputeOrderStatus(tx, item.order.id);
      if (input.action === "verify" && status === "COMPLETED") {
        await notify(tx, {
          organizationId: item.order.organizationId,
          branchId: item.order.branchId,
          type: "REPORT_READY",
          title: "Report ready",
          message: `Report for ${item.order.patient.name} (${item.order.orderNo}) is ready to print.`,
          link: `/reports/${item.order.id}`,
        });
      }
      return { ok: true, status };
    });
    if (result.error) return result.error;
    return json({ message: "Result updated.", orderStatus: result.status });
  } catch (error) {
    return handleError(error, "Result update");
  }
}
