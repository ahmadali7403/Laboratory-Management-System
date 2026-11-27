import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext, resolveWriteTarget, scopeWhere } from "@/lib/scope";
import { fail, handleError, isUuid, json, money, opt, optDate, optUuid, paging, parseBody, positive, req, round2 } from "@/lib/http";
import { enrichMedicine, recordStockMovement, todayUtcDate } from "@/lib/pharmacy";

export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const { scope } = auth.ctx;
    const sp = new URL(request.url).searchParams;
    const q = (sp.get("q") || "").trim().slice(0, 100);
    const categoryId = sp.get("categoryId");
    const companyId = sp.get("companyId");
    const supplierId = sp.get("supplierId");
    const status = sp.get("status");
    const stockFilter = sp.get("stock");
    const posMode = sp.get("pos") === "1";

    const and = [scopeWhere(scope)];
    if (posMode || sp.get("active") === "1") and.push({ status: "ACTIVE" });
    else if (["ACTIVE", "INACTIVE", "DISCONTINUED"].includes(status)) and.push({ status });

    if (isUuid(categoryId)) and.push({ categoryId });
    if (isUuid(companyId)) and.push({ companyId });
    if (isUuid(supplierId)) {
      and.push({ OR: [{ defaultSupplierId: supplierId }, { batches: { some: { supplierId } } }] });
    }
    if (q) {
      and.push({
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { genericName: { contains: q, mode: "insensitive" } },
          { barcode: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { strength: { contains: q, mode: "insensitive" } },
          { batches: { some: { batchNumber: { contains: q, mode: "insensitive" } } } },
        ],
      });
    }

    const where = { AND: and };

    if (posMode) {
      const todayUtc = todayUtcDate();
      const meds = await prisma.medicine.findMany({
        where,
        orderBy: [{ name: "asc" }],
        take: 120,
        include: {
          category: { select: { id: true, name: true } },
          company: { select: { id: true, name: true } },
          batches: {
            where: { isActive: true, quantity: { gt: 0 } },
            orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              batchNumber: true,
              expiryDate: true,
              purchasePrice: true,
              salePrice: true,
              mrp: true,
              quantity: true,
              isActive: true,
            },
          },
        },
      });
      const qLower = q.toLowerCase();
      const items = meds
        .map((m) => {
          const e = enrichMedicine(m);
          const validBatches = (m.batches || []).filter((b) => new Date(b.expiryDate) >= todayUtc && Number(b.quantity) > 0);
          const expiredBatches = (m.batches || []).filter((b) => new Date(b.expiryDate) < todayUtc && Number(b.quantity) > 0);
          return { ...e, validBatches, expiredBatches };
        })
        .sort((a, b) => {
          if (!qLower) return a.name.localeCompare(b.name);
          const exactA = (a.barcode || "").toLowerCase() === qLower || (a.sku || "").toLowerCase() === qLower ? 0 : 1;
          const exactB = (b.barcode || "").toLowerCase() === qLower || (b.sku || "").toLowerCase() === qLower ? 0 : 1;
          if (exactA !== exactB) return exactA - exactB;
          const startsA = a.name.toLowerCase().startsWith(qLower) ? 0 : 1;
          const startsB = b.name.toLowerCase().startsWith(qLower) ? 0 : 1;
          return startsA - startsB || a.name.localeCompare(b.name);
        });
      return json({ items, total: items.length });
    }

    const { page, pageSize, skip, take } = paging(sp, 20);
    const allMeds = await prisma.medicine.findMany({
      where,
      orderBy: [{ name: "asc" }],
      include: {
        branch: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
        defaultSupplier: { select: { id: true, name: true } },
        batches: {
          where: { isActive: true },
          orderBy: [{ expiryDate: "asc" }],
        },
      },
      take: stockFilter ? 2000 : undefined,
      skip: stockFilter ? undefined : skip,
      ...(stockFilter ? {} : { take }),
    });

    const enriched = allMeds.map((m) => enrichMedicine(m));
    const filtered = stockFilter
      ? enriched.filter((m) => (stockFilter === "ALERT" ? m.stockStatus === "LOW" || m.stockStatus === "OUT" : m.stockStatus === stockFilter))
      : enriched;

    const total = stockFilter ? filtered.length : await prisma.medicine.count({ where });
    const items = stockFilter ? filtered.slice(skip, skip + pageSize) : filtered;
    return json({ items, total, page, pageSize });
  } catch (error) {
    return handleError(error, "Medicines list");
  }
}

const initialBatchSchema = z.object({
  batchNumber: req(1, 60, "Batch number"),
  expiryDate: z.coerce.date({ message: "Valid expiry date is required." }),
  purchasePrice: money,
  salePrice: money,
  mrp: money.nullish(),
  quantity: money.default(0),
  supplierId: optUuid,
});

const createSchema = z.object({
  branchId: optUuid,
  name: req(2, 160, "Medicine name"),
  genericName: opt(160),
  categoryId: optUuid,
  companyId: optUuid,
  defaultSupplierId: optUuid,
  strength: opt(60),
  dosageForm: opt(60),
  unit: req(1, 20, "Unit").default("pcs"),
  packSize: z.coerce.number().int().min(1).max(10000).default(1),
  barcode: opt(80),
  sku: opt(60),
  lowStockAlert: money.default(10),
  defaultPurchasePrice: money.default(0),
  defaultSalePrice: money.default(0),
  rackLocation: opt(60),
  description: opt(500),
  status: z.enum(["ACTIVE", "INACTIVE", "DISCONTINUED"]).default("ACTIVE"),
  initialBatch: initialBatchSchema.optional(),
});

export async function POST(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const parsed = await parseBody(request, createSchema);
    if (parsed.error) return parsed.error;
    const data = parsed.data;

    const resolved = await resolveWriteTarget(auth.ctx, data, { branchRequired: true });
    if (resolved.error) return resolved.error;
    const { organizationId, branchId } = resolved.target;

    if (data.categoryId) {
      const cat = await prisma.medicineCategory.findFirst({ where: { id: data.categoryId, organizationId }, select: { id: true } });
      if (!cat) return fail("Category not found.", 404);
    }
    if (data.companyId) {
      const comp = await prisma.medicineCompany.findFirst({ where: { id: data.companyId, organizationId }, select: { id: true } });
      if (!comp) return fail("Company not found.", 404);
    }
    if (data.defaultSupplierId) {
      const sup = await prisma.supplier.findFirst({ where: { id: data.defaultSupplierId, organizationId }, select: { id: true } });
      if (!sup) return fail("Supplier not found.", 404);
    }
    if (data.barcode) {
      const dupBarcode = await prisma.medicine.findFirst({
        where: { organizationId, branchId, barcode: data.barcode },
        select: { id: true },
      });
      if (dupBarcode) return fail("A medicine with this barcode already exists in this branch.", 409);
    }

    const created = await prisma.$transaction(async (tx) => {
      const med = await tx.medicine.create({
        data: {
          organizationId,
          branchId,
          name: data.name,
          genericName: data.genericName,
          categoryId: data.categoryId || null,
          companyId: data.companyId || null,
          defaultSupplierId: data.defaultSupplierId || null,
          strength: data.strength,
          dosageForm: data.dosageForm,
          unit: data.unit,
          packSize: data.packSize,
          barcode: data.barcode,
          sku: data.sku,
          lowStockAlert: data.lowStockAlert,
          defaultPurchasePrice: data.initialBatch ? data.initialBatch.purchasePrice : data.defaultPurchasePrice,
          defaultSalePrice: data.initialBatch ? data.initialBatch.salePrice : data.defaultSalePrice,
          rackLocation: data.rackLocation,
          description: data.description,
          status: data.status,
        },
      });

      if (data.initialBatch) {
        const b = data.initialBatch;
        const supId = b.supplierId || data.defaultSupplierId || null;
        const batch = await tx.medicineBatch.create({
          data: {
            organizationId,
            branchId,
            medicineId: med.id,
            batchNumber: b.batchNumber,
            expiryDate: b.expiryDate,
            purchasePrice: round2(b.purchasePrice),
            salePrice: round2(b.salePrice),
            mrp: b.mrp != null ? round2(b.mrp) : null,
            initialQuantity: round2(b.quantity),
            quantity: round2(b.quantity),
            supplierId: supId,
          },
        });
        if (Number(b.quantity) > 0) {
          await recordStockMovement(tx, {
            organizationId,
            branchId,
            medicineId: med.id,
            batchId: batch.id,
            type: "INITIAL_STOCK",
            quantityChange: b.quantity,
            balanceBefore: 0,
            balanceAfter: b.quantity,
            referenceType: "MEDICINE",
            referenceId: med.id,
            reason: `Initial batch ${b.batchNumber}`,
            createdByName: auth.ctx.actor.name,
          });
        }
      }

      return med;
    });

    return json({ id: created.id, message: "Medicine created." }, 201);
  } catch (error) {
    return handleError(error, "Medicine create");
  }
}
