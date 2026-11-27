import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, authorityWhere, scopeWhere } from "@/lib/scope";
import { fail, handleError, json, paging, parseBody, positive, req, round2, uuid } from "@/lib/http";
import { recordStockMovement } from "@/lib/pharmacy";

export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const sp = new URL(request.url).searchParams;
    const view = sp.get("view") === "movements" ? "movements" : "adjustments";
    const { page, pageSize, skip, take } = paging(sp, 20);
    const q = (sp.get("q") || "").trim().slice(0, 80);
    const base = scopeWhere(auth.ctx.scope);
    const search = q
      ? {
          OR: [
            { medicine: { name: { contains: q, mode: "insensitive" } } },
            { batch: { batchNumber: { contains: q, mode: "insensitive" } } },
            { reason: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};
    const where = { AND: [base, search] };

    if (view === "movements") {
      const [items, total] = await Promise.all([
        prisma.pharmacyStockMovement.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
          include: {
            medicine: { select: { id: true, name: true, unit: true } },
            batch: { select: { id: true, batchNumber: true, expiryDate: true } },
            branch: { select: { id: true, name: true } },
          },
        }),
        prisma.pharmacyStockMovement.count({ where }),
      ]);
      return json({ items, total, page, pageSize });
    }

    const [items, total] = await Promise.all([
      prisma.pharmacyStockAdjustment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          medicine: { select: { id: true, name: true, unit: true } },
          batch: { select: { id: true, batchNumber: true, expiryDate: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
      prisma.pharmacyStockAdjustment.count({ where }),
    ]);
    return json({ items, total, page, pageSize });
  } catch (error) {
    return handleError(error, "Pharmacy stock");
  }
}

const adjustSchema = z.object({
  batchId: uuid,
  adjustmentType: z.enum(["INCREASE", "DECREASE", "DAMAGED", "EXPIRED_WRITE_OFF", "CORRECTION"]),
  direction: z.enum(["ADD", "SUBTRACT"]).optional(),
  quantity: positive,
  reason: req(2, 300, "Reason"),
});

export async function POST(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const parsed = await parseBody(request, adjustSchema);
    if (parsed.error) return parsed.error;
    const data = parsed.data;
    const qty = round2(data.quantity);

    const result = await prisma.$transaction(async (tx) => {
      const found = await tx.medicineBatch.findFirst({
        where: { id: data.batchId, ...authorityWhere(auth.ctx.actor) },
        select: { id: true },
      });
      if (!found) return { error: fail("Batch not found.", 404) };
      await tx.$queryRaw`SELECT id FROM "MedicineBatch" WHERE id = ${data.batchId}::uuid FOR UPDATE`;

      const batch = await tx.medicineBatch.findUnique({ where: { id: data.batchId } });
      const prev = round2(Number(batch.quantity));
      const isIncrease =
        data.adjustmentType === "INCREASE" ||
        (data.adjustmentType === "CORRECTION" && data.direction === "ADD");
      const delta = isIncrease ? qty : round2(-qty);
      const nextStock = round2(prev + delta);

      if (nextStock < 0) return { error: fail(`Insufficient batch stock (${prev} available). Cannot go negative.`, 409) };

      await tx.medicineBatch.update({ where: { id: batch.id }, data: { quantity: nextStock } });
      const adj = await tx.pharmacyStockAdjustment.create({
        data: {
          organizationId: batch.organizationId,
          branchId: batch.branchId,
          medicineId: batch.medicineId,
          batchId: batch.id,
          adjustmentType: data.adjustmentType,
          quantity: qty,
          previousStock: prev,
          newStock: nextStock,
          reason: data.reason,
          adjustedByName: auth.ctx.actor.name,
        },
      });
      await recordStockMovement(tx, {
        organizationId: batch.organizationId,
        branchId: batch.branchId,
        medicineId: batch.medicineId,
        batchId: batch.id,
        type: delta >= 0 ? "ADJUSTMENT_ADD" : "ADJUSTMENT_SUB",
        quantityChange: delta,
        balanceBefore: prev,
        balanceAfter: nextStock,
        referenceType: "ADJUSTMENT",
        referenceId: adj.id,
        reason: `${data.adjustmentType.replace(/_/g, " ")}: ${data.reason}`,
        createdByName: auth.ctx.actor.name,
      });
      return { adj, nextStock };
    });

    if (result.error) return result.error;
    return json({ id: result.adj.id, newStock: result.nextStock, message: "Stock adjustment recorded." }, 201);
  } catch (error) {
    return handleError(error, "Stock adjustment");
  }
}
