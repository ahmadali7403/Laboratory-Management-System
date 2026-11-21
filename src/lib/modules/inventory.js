import { z } from "zod";
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

export const inventory = createCrud({
  model: "inventoryItem",
  label: "Inventory item",
  createSchema: schema,
  orderBy: [{ name: "asc" }],
  searchFields: ["name", "sku"],
  filters: (sp) => (sp.get("active") === "1" ? [{ isActive: true }] : []),
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
