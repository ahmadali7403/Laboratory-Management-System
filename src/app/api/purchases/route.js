import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, resolveWriteTarget, scopeWhere } from "@/lib/scope";
import { fail, handleError, json, money, opt, optUuid, paging, parseBody, positive, round2, uuid } from "@/lib/http";
import { nextNumber } from "@/lib/sequence";

export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const sp = new URL(request.url).searchParams;
    const { page, pageSize, skip, take } = paging(sp);
    const q = (sp.get("q") || "").trim().slice(0, 100);
    const status = sp.get("status");
    const and = [scopeWhere(auth.ctx.scope)];
    if (["ORDERED", "RECEIVED", "CANCELLED"].includes(status)) and.push({ status });
    if (q) and.push({ OR: [{ purchaseNo: { contains: q, mode: "insensitive" } }, { supplier: { name: { contains: q, mode: "insensitive" } } }] });
    const where = { AND: and };
    const [items, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          supplier: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          items: { include: { inventoryItem: { select: { name: true, unit: true } } } },
        },
      }),
      prisma.purchase.count({ where }),
    ]);
    return json({ items, total, page, pageSize });
  } catch (error) {
    return handleError(error, "Purchases list");
  }
}

const schema = z.object({
  branchId: optUuid,
  supplierId: uuid,
  purchaseDate: z.coerce.date({ message: "Valid purchase date is required." }),
  notes: opt(500),
  receiveNow: z.boolean().default(false),
  items: z
    .array(z.object({ inventoryItemId: uuid, quantity: positive, unitCost: money }))
    .min(1, "Add at least one item.")
    .max(100),
});

export async function POST(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const parsed = await parseBody(request, schema);
    if (parsed.error) return parsed.error;
    const data = parsed.data;

    const resolved = await resolveWriteTarget(auth.ctx, data, { branchRequired: true });
    if (resolved.error) return resolved.error;
    const { organizationId, branchId } = resolved.target;

    const supplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, organizationId, isActive: true, OR: [{ branchId: null }, { branchId }] },
      select: { id: true },
    });
    if (!supplier) return fail("Supplier not found.", 404);

    const itemIds = [...new Set(data.items.map((i) => i.inventoryItemId))];
    if (itemIds.length !== data.items.length) return fail("Each inventory item can appear only once.", 400);
    const stock = await prisma.inventoryItem.count({ where: { id: { in: itemIds }, organizationId, branchId } });
    if (stock !== itemIds.length) return fail("One or more inventory items were not found in this branch.", 404);

    const total = round2(data.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0));

    const purchase = await prisma.$transaction(async (tx) => {
      const purchaseNo = await nextNumber(tx, organizationId, "purchase", "PUR");
      const created = await tx.purchase.create({
        data: {
          organizationId,
          branchId,
          purchaseNo,
          supplierId: supplier.id,
          total,
          purchaseDate: data.purchaseDate,
          notes: data.notes,
          createdByName: auth.ctx.actor.name,
          status: data.receiveNow ? "RECEIVED" : "ORDERED",
          receivedAt: data.receiveNow ? new Date() : null,
          items: { create: data.items.map((i) => ({ inventoryItemId: i.inventoryItemId, quantity: i.quantity, unitCost: i.unitCost })) },
        },
      });
      if (data.receiveNow) {
        for (const i of data.items) {
          await tx.inventoryItem.update({ where: { id: i.inventoryItemId }, data: { quantity: { increment: i.quantity }, unitCost: i.unitCost } });
        }
      }
      return created;
    });
    return json({ id: purchase.id, purchaseNo: purchase.purchaseNo, message: "Purchase created." }, 201);
  } catch (error) {
    return handleError(error, "Purchase create");
  }
}
