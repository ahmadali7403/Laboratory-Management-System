import { z } from "zod";
import { createCrud } from "@/lib/crud";
import { opt, optUuid, req } from "@/lib/http";
import { personName, phoneField } from "@/lib/validators";

const schema = z.object({
  branchId: optUuid,
  name: personName("Doctor name"),
  specialization: opt(120),
  phone: phoneField,
  email: z.string().trim().email("Invalid email address.").max(120).nullish().or(z.literal("")).transform((v) => v || null),
  isActive: z.boolean().default(true),
});

export const doctors = createCrud({
  model: "doctor",
  label: "Doctor",
  dependents: ["orders"],
  orgWide: true,
  createSchema: schema,
  orderBy: [{ name: "asc" }],
  searchFields: ["name", "specialization", "phone"],
  filters: (sp) => (sp.get("active") === "1" ? [{ isActive: true }] : []),
});
