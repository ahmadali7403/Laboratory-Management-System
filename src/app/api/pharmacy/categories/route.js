import { z } from "zod";
import { createCrud } from "@/lib/crud";
import { opt, optUuid, req } from "@/lib/http";

const schema = z.object({
  branchId: optUuid,
  name: req(2, 100, "Category name"),
  description: opt(300),
  isActive: z.boolean().default(true),
});

export const medicineCategories = createCrud({
  model: "medicineCategory",
  label: "Medicine category",
  orgWide: true,
  cacheTtlMs: 30_000,
  dependents: ["medicines"],
  createSchema: schema,
  orderBy: [{ name: "asc" }],
  searchFields: ["name", "description"],
  filters: (sp) => (sp.get("active") === "1" ? [{ isActive: true }] : []),
});

export const { GET, POST } = medicineCategories.collection;
