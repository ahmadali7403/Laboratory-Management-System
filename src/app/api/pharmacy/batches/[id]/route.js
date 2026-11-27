import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, authorityWhere } from "@/lib/scope";
import { fail, handleError, isUuid, json, money, opt, parseBody, round2 } from "@/lib/http";

const patchSchema = z.object({
  purchasePrice: money.optional(),
  salePrice: money.optional(),
  mrp: money.nullish(),
  expiryDate: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
  notes: opt(300),
  reason: opt(200),
});

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    if (!isUuid(id)) return fail("Batch not found.", 404);

    const existing = await prisma.medicineBatch.findFirst({ where: { id, ...authorityWhere(auth.ctx.actor) } });
    if (!existing) return fail("Batch not found.", 404);

    const parsed = await parseBody(request, patchSchema);
    if (parsed.error) return parsed.error;
    const { reason, ...data } = parsed.data;

    await prisma.$transaction(async (tx) => {
      await tx.medicineBatch.update({
        where: { id },
        data: {
          ...(data.purchasePrice !== undefined ? { purchasePrice: round2(data.purchasePrice) } : {}),
          ...(data.salePrice !== undefined ? { salePrice: round2(data.salePrice) } : {}),
          ...(data.mrp !== undefined ? { mrp: data.mrp != null ? round2(data.mrp) : null } : {}),
          ...(data.expiryDate !== undefined ? { expiryDate: data.expiryDate } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        },
      });

      const oldCost = Number(existing.purchasePrice);
      const oldSale = Number(existing.salePrice);
      const newCost = data.purchasePrice !== undefined ? round2(data.purchasePrice) : oldCost;
      const newSale = data.salePrice !== undefined ? round2(data.salePrice) : oldSale;
      if (oldCost !== newCost || oldSale !== newSale) {
        await tx.pharmacyPriceAudit.create({
          data: {
            organizationId: existing.organizationId,
            branchId: existing.branchId,
            medicineId: existing.medicineId,
            batchId: existing.id,
            oldPurchasePrice: oldCost,
            newPurchasePrice: newCost,
            oldSalePrice: oldSale,
            newSalePrice: newSale,
            reason: reason || `Batch ${existing.batchNumber} price updated`,
            changedByName: auth.ctx.actor.name,
          },
        });
      }
    });

    return json({ message: "Batch updated." });
  } catch (error) {
    return handleError(error, "Batch update");
  }
}
