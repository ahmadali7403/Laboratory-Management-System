import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createCrud } from "@/lib/crud";
import { notify } from "@/lib/notify";
import { money, opt, optUuid, req } from "@/lib/http";

const schema = z.object({
  branchId: optUuid,
  name: req(2, 150, "Item name"),
  sku: opt(60),
  unit: req(1, 20, "Unit").default("pcs"),
  quantity: money.default(0),
  reorderLevel: money.default(0),
  unitCost: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0).max(1e9).nullable()).optional(),
  isActive: z.boolean().default(true),
});

// Stock status rules (same as the existing "Low" badge): OUT = quantity <= 0,
// LOW = reorder level set and quantity <= reorder level, NORMAL = everything else.
const LOW_SQL = Prisma.sql`("reorderLevel" > 0 AND quantity > 0 AND quantity <= "reorderLevel")`;
const OUT_SQL = Prisma.sql`(quantity <= 0)`;
const STOCK_SQL = {
  OUT: OUT_SQL,
  LOW: LOW_SQL,
  ALERT: Prisma.sql`(${OUT_SQL} OR ${LOW_SQL})`,
  NORMAL: Prisma.sql`(NOT ${OUT_SQL} AND NOT ${LOW_SQL})`,
};
const scopeSql = (scope) => Prisma.sql`${scope.organizationId ? Prisma.sql`AND "organizationId" = ${scope.organizationId}::uuid` : Prisma.empty} ${scope.branchId ? Prisma.sql`AND "branchId" = ${scope.branchId}::uuid` : Prisma.empty}`;

async function idsByStock(scope, status) {
  const rows = await prisma.$queryRaw`SELECT id FROM "InventoryItem" WHERE "isActive" = true AND ${STOCK_SQL[status]} ${scopeSql(scope)} LIMIT 5000`;
  return rows.map((r) => r.id);
}

export const inventory = createCrud({
  model: "inventoryItem",
  label: "Inventory item",
  createSchema: schema,
  orderBy: [{ name: "asc" }],
  searchFields: ["name", "sku"],
  include: {
    branch: { select: { id: true, name: true, code: true } },
    // most recent supplier of this item (from purchase history) - the only supplier data the schema holds
    purchaseItems: { take: 1, orderBy: { purchase: { purchaseDate: "desc" } }, select: { purchase: { select: { supplier: { select: { id: true, name: true, phone: true } } } } } },
  },
  filters: async (sp, scope) => {
    const out = [];
    if (sp.get("active") === "1") out.push({ isActive: true });
    const stock = sp.get("stock");
    if (STOCK_SQL[stock]) out.push({ isActive: true, id: { in: await idsByStock(scope, stock) } });
    const supplierId = sp.get("supplierId");
    if (supplierId && /^[0-9a-f-]{36}$/i.test(supplierId)) out.push({ purchaseItems: { some: { purchase: { supplierId } } } });
    const from = sp.get("from"), to = sp.get("to");
    if (from && !Number.isNaN(Date.parse(from))) out.push({ createdAt: { gte: new Date(from) } });
    if (to && !Number.isNaN(Date.parse(to))) out.push({ createdAt: { lte: new Date(`${to}T23:59:59.999Z`) } });
    return out;
  },
  extra: async (_where, scope) => {
    const [r] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS items,
             COUNT(*) FILTER (WHERE ${OUT_SQL})::int AS out,
             COUNT(*) FILTER (WHERE ${LOW_SQL})::int AS low,
             COALESCE(SUM(quantity * "unitCost") FILTER (WHERE "unitCost" IS NOT NULL), 0)::float AS value,
             COUNT(*) FILTER (WHERE "unitCost" IS NULL)::int AS "noCost"
      FROM "InventoryItem" WHERE "isActive" = true ${scopeSql(scope)}`;
    return { summary: r };
  },
  conflictMessage: "An item with this name already exists in this branch.",
  afterWrite: async ({ tx }, row) => {
    if (row.isActive && Number(row.quantity) <= Number(row.reorderLevel) && Number(row.reorderLevel) > 0) {
      await notify(tx, {
        organizationId: row.organizationId,
        branchId: row.branchId,
        type: "LOW_STOCK",
        title: "Low stock",
        message: `${row.name} is at or below its reorder level (${Number(row.quantity)} ${row.unit}).`,
        link: "/inventory",
      });
    }
  },
});
