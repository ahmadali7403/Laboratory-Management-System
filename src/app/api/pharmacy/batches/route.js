import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, scopeWhere } from "@/lib/scope";
import { fail, handleError, isUuid, json, money, opt, optUuid, paging, parseBody, req, round2, uuid } from "@/lib/http";
import { recordStockMovement } from "@/lib/pharmacy";

export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const sp = new URL(request.url).searchParams;
    const { page, pageSize, skip, take } = paging(sp, 25);
    const medicineId = sp.get("medicineId");
    const q = (sp.get("q") || "").trim().slice(0, 80);

    const and = [scopeWhere(auth.ctx.scope)];
    if (isUuid(medicineId)) and.push({ medicineId });
    if (sp.get("inStock") === "1") and.push({ quantity: { gt: 0 }, isActive: true });
    if (q) {
      and.push({
        OR: [
          { batchNumber: { contains: q, mode: "insensitive" } },
          { medicine: { name: { contains: q, mode: "insensitive" } } },
          { medicine: { genericName: { contains: q, mode: "insensitive" } } },
        ],
      });
    }
    const where = { AND: and };
    const [items, total] = await Promise.all([
      prisma.medicineBatch.findMany({
        where,
        orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
        skip,
        take,
        include: {
          medicine: { select: { id: true, name: true, genericName: true, strength: true, unit: true } },
          supplier: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
      prisma.medicineBatch.count({ where }),
    ]);
    return json({ items, total, page, pageSize });
  } catch (error) {
    return handleError(error, "Batches list");
  }
}

const createSchema = z.object({
  medicineId: uuid,
  batchNumber: req(1, 60, "Batch number"),
  expiryDate: z.coerce.date({ message: "Valid expiry date is required." }),
  purchasePrice: money,
  salePrice: money,
  mrp: money.nullish(),
  quantity: money.default(0),
  supplierId: optUuid,
  notes: opt(300),
});

export async function POST(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const parsed = await parseBody(request, createSchema);
    if (parsed.error) return parsed.error;
    const data = parsed.data;

    const medicine = await prisma.medicine.findFirst({
      where: { id: data.medicineId, ...scopeWhere(auth.ctx.scope) },
      select: { id: true, organizationId: true, branchId: true },
    });
    if (!medicine) return fail("Medicine not found.", 404);

    if (data.supplierId) {
      const sup = await prisma.supplier.findFirst({
        where: { id: data.supplierId, organizationId: medicine.organizationId },
        select: { id: true },
      });
      if (!sup) return fail("Supplier not found.", 404);
    }

    // Never silently overwrite an existing batch row; create a dedicated batch entry.
    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.medicineBatch.create({
        data: {
          organizationId: medicine.organizationId,
          branchId: medicine.branchId,
          medicineId: medicine.id,
          batchNumber: data.batchNumber,
          expiryDate: data.expiryDate,
          purchasePrice: round2(data.purchasePrice),
          salePrice: round2(data.salePrice),
          mrp: data.mrp != null ? round2(data.mrp) : null,
          initialQuantity: round2(data.quantity),
          quantity: round2(data.quantity),
          supplierId: data.supplierId || null,
          notes: data.notes,
        },
      });
      if (Number(data.quantity) > 0) {
        await recordStockMovement(tx, {
          organizationId: medicine.organizationId,
          branchId: medicine.branchId,
          medicineId: medicine.id,
          batchId: created.id,
          type: "INITIAL_STOCK",
          quantityChange: data.quantity,
          balanceBefore: 0,
          balanceAfter: data.quantity,
          referenceType: "BATCH",
          referenceId: created.id,
          reason: data.notes || `Added batch ${data.batchNumber}`,
          createdByName: auth.ctx.actor.name,
        });
      }
      return created;
    });

    return json({ id: batch.id, message: "Batch added." }, 201);
  } catch (error) {
    return handleError(error, "Batch create");
  }
}
