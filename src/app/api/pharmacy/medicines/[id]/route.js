import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, authorityWhere } from "@/lib/scope";
import { fail, handleError, isUuid, json, money, opt, optUuid, parseBody, req, round2 } from "@/lib/http";
import { enrichMedicine } from "@/lib/pharmacy";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    if (!isUuid(id)) return fail("Medicine not found.", 404);

    const med = await prisma.medicine.findFirst({
      where: { id, ...authorityWhere(auth.ctx.actor) },
      include: {
        branch: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
        defaultSupplier: { select: { id: true, name: true } },
        batches: {
          orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
          include: {
            supplier: { select: { id: true, name: true } },
            purchase: { select: { id: true, purchaseNo: true } },
          },
        },
        priceAudits: { orderBy: { createdAt: "desc" }, take: 30, include: { batch: { select: { batchNumber: true } } } },
        stockMovements: { orderBy: { createdAt: "desc" }, take: 40, include: { batch: { select: { batchNumber: true } } } },
      },
    });
    if (!med) return fail("Medicine not found.", 404);
    return json(enrichMedicine(med));
  } catch (error) {
    return handleError(error, "Medicine detail");
  }
}

const patchSchema = z.object({
  name: req(2, 160, "Medicine name").optional(),
  genericName: opt(160),
  categoryId: optUuid,
  companyId: optUuid,
  defaultSupplierId: optUuid,
  strength: opt(60),
  dosageForm: opt(60),
  unit: req(1, 20, "Unit").optional(),
  packSize: z.coerce.number().int().min(1).max(10000).optional(),
  barcode: opt(80),
  sku: opt(60),
  lowStockAlert: money.optional(),
  defaultPurchasePrice: money.optional(),
  defaultSalePrice: money.optional(),
  rackLocation: opt(60),
  description: opt(500),
  status: z.enum(["ACTIVE", "INACTIVE", "DISCONTINUED"]).optional(),
  priceChangeReason: opt(200),
});

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    if (!isUuid(id)) return fail("Medicine not found.", 404);

    const existing = await prisma.medicine.findFirst({ where: { id, ...authorityWhere(auth.ctx.actor) } });
    if (!existing) return fail("Medicine not found.", 404);

    const parsed = await parseBody(request, patchSchema);
    if (parsed.error) return parsed.error;
    const { priceChangeReason, ...data } = parsed.data;

    if (data.barcode && data.barcode !== existing.barcode) {
      const dup = await prisma.medicine.findFirst({
        where: { organizationId: existing.organizationId, branchId: existing.branchId, barcode: data.barcode, id: { not: existing.id } },
        select: { id: true },
      });
      if (dup) return fail("Another medicine with this barcode already exists in this branch.", 409);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.medicine.update({ where: { id }, data });
      const oldCost = Number(existing.defaultPurchasePrice);
      const oldSale = Number(existing.defaultSalePrice);
      const newCost = data.defaultPurchasePrice !== undefined ? round2(data.defaultPurchasePrice) : oldCost;
      const newSale = data.defaultSalePrice !== undefined ? round2(data.defaultSalePrice) : oldSale;
      if (oldCost !== newCost || oldSale !== newSale) {
        await tx.pharmacyPriceAudit.create({
          data: {
            organizationId: existing.organizationId,
            branchId: existing.branchId,
            medicineId: existing.id,
            oldPurchasePrice: oldCost,
            newPurchasePrice: newCost,
            oldSalePrice: oldSale,
            newSalePrice: newSale,
            reason: priceChangeReason || "Catalog price updated",
            changedByName: auth.ctx.actor.name,
          },
        });
      }
      return row;
    });

    return json({ id: updated.id, message: "Medicine updated." });
  } catch (error) {
    return handleError(error, "Medicine update");
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    if (!isUuid(id)) return fail("Medicine not found.", 404);
    const existing = await prisma.medicine.findFirst({
      where: { id, ...authorityWhere(auth.ctx.actor) },
      include: { _count: { select: { batches: true, purchaseItems: true, saleItems: true } } },
    });
    if (!existing) return fail("Medicine not found.", 404);

    if (existing._count.batches > 0 || existing._count.purchaseItems > 0 || existing._count.saleItems > 0) {
      await prisma.medicine.update({ where: { id }, data: { status: "INACTIVE" } });
      return json({ message: "Medicine has batches or transactions, so it was marked inactive instead of deleted.", deactivated: true });
    }
    await prisma.medicine.delete({ where: { id } });
    return json({ message: "Medicine deleted." });
  } catch (error) {
    return handleError(error, "Medicine delete");
  }
}
