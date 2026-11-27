import { z } from "zod";
import { createCrud } from "@/lib/crud";
import { opt, optUuid, req } from "@/lib/http";

const schema = z.object({
  branchId: optUuid,
  name: req(2, 120, "Company name"),
  country: opt(80),
  phone: opt(30),
  email: z.string().trim().email("Invalid email address.").max(120).nullish().or(z.literal("")).transform((v) => v || null),
  isActive: z.boolean().default(true),
});

export const medicineCompanies = createCrud({
  model: "medicineCompany",
  label: "Medicine company",
  orgWide: true,
  dependents: ["medicines"],
  createSchema: schema,
  orderBy: [{ name: "asc" }],
  searchFields: ["name", "country"],
  filters: (sp) => (sp.get("active") === "1" ? [{ isActive: true }] : []),
});

export const { GET, POST } = medicineCompanies.collection;
