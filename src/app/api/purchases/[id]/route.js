import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, authorityWhere } from "@/lib/scope";
import { fail, handleError, isUuid, json, parseBody } from "@/lib/http";

const schema = z.object({ action: z.enum(["receive", "cancel"]) });

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    if (!isUuid(id)) return fail("Purchase not found.", 404);
    const parsed = await parseBody(request, schema);
    if (parsed.error) return parsed.error;

    const result = await prisma.$transaction(async (tx) => {
      const found = await tx.purchase.findFirst({ where: { id, ...authorityWhere(auth.ctx.actor) }, select: { id: true } });
      if (!found) return { error: fail("Purchase not found.", 404) };
      await tx.$queryRaw`SELECT id FROM "Purchase" WHERE id = ${id}::uuid FOR UPDATE`;
      const purchase = await tx.purchase.findUnique({ where: { id }, include: { items: true } });
      if (purchase.status !== "ORDERED") return { error: fail(`This purchase is already ${purchase.status.toLowerCase()}.`, 409) };

      if (parsed.data.action === "receive") {
        for (const item of purchase.items) {
          await tx.inventoryItem.update({ where: { id: item.inventoryItemId }, data: { quantity: { increment: item.quantity }, unitCost: item.unitCost } });
        }
        await tx.purchase.update({ where: { id }, data: { status: "RECEIVED", receivedAt: new Date() } });
      } else {
        await tx.purchase.update({ where: { id }, data: { status: "CANCELLED" } });
      }
      return { ok: true };
    });
    if (result.error) return result.error;
    return json({ message: parsed.data.action === "receive" ? "Stock received and inventory updated." : "Purchase cancelled." });
  } catch (error) {
    return handleError(error, "Purchase update");
  }
}
