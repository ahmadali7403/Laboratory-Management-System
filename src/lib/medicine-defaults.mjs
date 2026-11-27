import crypto from "node:crypto";
import {
  COMMON_MEDICINES,
  PHARMACY_CATEGORIES,
  PHARMACY_COMPANIES,
} from "./medicine-defaults-data.mjs";

export { COMMON_MEDICINES, PHARMACY_CATEGORIES, PHARMACY_COMPANIES };

/** Deterministic RFC-4122-compatible UUID from a stable namespace string. */
export function seedUuid(key) {
  const hex = crypto.createHash("sha256").update(String(key)).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ["8", "9", "a", "b"][parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20, 32).join("")}`;
}

function futureUtcDate(months) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, 28));
}

async function runInChunks(items, size, fn) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map((item, j) => fn(item, i + j)));
  }
}

/**
 * Idempotently seeds 240 common Pakistani/South Asian pharmacy medicines
 * for an organization branch using Prisma `upsert`.
 * Re-running never creates duplicate records or overwrites existing stock balances.
 */
export async function seedCommonMedicines(
  db,
  { organizationId, branchId, createdByName = "System Seed" },
) {
  const existingCats = await db.medicineCategory.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  });
  const catByName = new Map(existingCats.map((c) => [c.name.toLowerCase(), c.id]));

  await runInChunks(PHARMACY_CATEGORIES, 6, async (cat) => {
    const id = catByName.get(cat.name.toLowerCase()) || seedUuid(`medcat:${organizationId}:${cat.name}`);
    const row = await db.medicineCategory.upsert({
      where: { id },
      update: { description: cat.description, isActive: true },
      create: {
        id,
        organizationId,
        branchId: null,
        name: cat.name,
        description: cat.description,
        isActive: true,
      },
      select: { id: true, name: true },
    });
    catByName.set(row.name.toLowerCase(), row.id);
  });

  const existingCos = await db.medicineCompany.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  });
  const coByName = new Map(existingCos.map((c) => [c.name.toLowerCase(), c.id]));

  await runInChunks(PHARMACY_COMPANIES, 8, async (co) => {
    const id = coByName.get(co.name.toLowerCase()) || seedUuid(`medco:${organizationId}:${co.name}`);
    const row = await db.medicineCompany.upsert({
      where: { id },
      update: { country: co.country, isActive: true },
      create: {
        id,
        organizationId,
        branchId: null,
        name: co.name,
        country: co.country,
        isActive: true,
      },
      select: { id: true, name: true },
    });
    coByName.set(row.name.toLowerCase(), row.id);
  });

  const existingSupplier = await db.supplier.findFirst({
    where: { organizationId, name: "National Pharma Distributors" },
    select: { id: true },
  });
  const supplierId =
    existingSupplier?.id || seedUuid(`medsup:${organizationId}:National Pharma Distributors`);
  await db.supplier.upsert({
    where: { id: supplierId },
    update: { isActive: true },
    create: {
      id: supplierId,
      organizationId,
      branchId: null,
      name: "National Pharma Distributors",
      contactPerson: "Wholesale Desk",
      phone: "+92 42 35001122",
      address: "Main Wholesale Medicine Market, Lahore",
      isActive: true,
    },
  });

  const [existingMeds, existingBatches] = await Promise.all([
    db.medicine.findMany({
      where: { organizationId, branchId },
      select: { id: true, sku: true, barcode: true, name: true },
    }),
    db.medicineBatch.findMany({
      where: { organizationId, branchId },
      select: { id: true, medicineId: true, batchNumber: true },
    }),
  ]);

  const medBySku = new Map(existingMeds.filter((m) => m.sku).map((m) => [m.sku, m.id]));
  const medByBarcode = new Map(existingMeds.filter((m) => m.barcode).map((m) => [m.barcode, m.id]));
  const medByName = new Map(existingMeds.map((m) => [m.name.toLowerCase(), m.id]));

  const batchSet = new Set(existingBatches.map((b) => `${b.medicineId}:${b.batchNumber}`));
  const batchIdByKey = new Map(existingBatches.map((b) => [`${b.medicineId}:${b.batchNumber}`, b.id]));

  let medicinesUpserted = 0;
  let batchesCreated = 0;
  const stockMovements = [];

  await runInChunks(COMMON_MEDICINES, 12, async (item) => {
    const medId =
      medBySku.get(item.sku) ||
      medByBarcode.get(item.barcode) ||
      medByName.get(item.name.toLowerCase()) ||
      seedUuid(`med:${organizationId}:${branchId}:${item.sku}`);

    const categoryId = catByName.get(item.category.toLowerCase()) || null;
    const companyId = coByName.get(item.company.toLowerCase()) || null;

    await db.medicine.upsert({
      where: { id: medId },
      update: {
        genericName: item.genericName,
        categoryId,
        companyId,
        defaultSupplierId: supplierId,
        strength: item.strength,
        dosageForm: item.dosageForm,
        unit: item.unit,
        packSize: item.packSize,
        barcode: item.barcode,
        sku: item.sku,
        rackLocation: item.rackLocation,
        description: item.description,
      },
      create: {
        id: medId,
        organizationId,
        branchId,
        name: item.name,
        genericName: item.genericName,
        categoryId,
        companyId,
        defaultSupplierId: supplierId,
        strength: item.strength,
        dosageForm: item.dosageForm,
        unit: item.unit,
        packSize: item.packSize,
        barcode: item.barcode,
        sku: item.sku,
        lowStockAlert: item.lowStockAlert,
        defaultPurchasePrice: item.defaultPurchasePrice,
        defaultSalePrice: item.defaultSalePrice,
        rackLocation: item.rackLocation,
        description: item.description,
        status: "ACTIVE",
      },
    });
    medicinesUpserted++;

    const bKey = `${medId}:${item.batchNumber}`;
    const hadBatch = batchSet.has(bKey);
    const batchId =
      batchIdByKey.get(bKey) ||
      seedUuid(`medbatch:${organizationId}:${branchId}:${item.sku}:${item.batchNumber}`);

    // Upsert with no-op update preserves live inventory balances on repeat runs.
    await db.medicineBatch.upsert({
      where: { id: batchId },
      update: {},
      create: {
        id: batchId,
        organizationId,
        branchId,
        medicineId: medId,
        batchNumber: item.batchNumber,
        expiryDate: futureUtcDate(item.expiryMonths),
        purchasePrice: item.defaultPurchasePrice,
        salePrice: item.defaultSalePrice,
        mrp: item.defaultSalePrice,
        initialQuantity: item.stockQty,
        quantity: item.stockQty,
        supplierId,
        isActive: true,
        notes: "Common pharmacy starter stock",
      },
    });

    if (!hadBatch) {
      batchesCreated++;
      stockMovements.push({
        organizationId,
        branchId,
        medicineId: medId,
        batchId,
        type: "INITIAL_STOCK",
        quantityChange: item.stockQty,
        balanceBefore: 0,
        balanceAfter: item.stockQty,
        referenceType: "SEED",
        referenceId: medId,
        referenceNo: item.sku,
        reason: `Starter batch ${item.batchNumber}`,
        createdByName,
      });
    }
  });

  if (stockMovements.length) {
    await db.pharmacyStockMovement.createMany({ data: stockMovements });
  }

  return {
    totalCatalog: COMMON_MEDICINES.length,
    medicinesUpserted,
    batchesCreated,
  };
}
