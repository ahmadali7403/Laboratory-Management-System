import { z } from "zod";
import { createCrud } from "@/lib/crud";
import { opt, optUuid, req } from "@/lib/http";
import { phoneField } from "@/lib/validators";

const schema = z.object({
  branchId: optUuid,
  name: req(2, 150, "Supplier name"),
  contactPerson: opt(120),
  phone: phoneField,
  email: z.string().trim().email("Invalid email address.").max(120).nullish().or(z.literal("")).transform((v) => v || null),
  address: opt(300),
  isActive: z.boolean().default(true),
});

export const suppliers = createCrud({
  model: "supplier",
  label: "Supplier",
  orgWide: true,
  createSchema: schema,
  orderBy: [{ name: "asc" }],
  searchFields: ["name", "contactPerson", "phone"],
  filters: (sp) => (sp.get("active") === "1" ? [{ isActive: true }] : []),
});
