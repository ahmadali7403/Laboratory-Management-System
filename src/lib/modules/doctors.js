import { z } from "zod";
import { createCrud } from "@/lib/crud";
import { opt, optUuid, req } from "@/lib/http";

const schema = z.object({
  branchId: optUuid,
  name: req(2, 120, "Doctor name"),
  specialization: opt(120),
  phone: opt(30),
  email: z.string().trim().email("Invalid email address.").max(120).nullish().or(z.literal("")).transform((v) => v || null),
  isActive: z.boolean().default(true),
});

export const doctors = createCrud({
  model: "doctor",
  label: "Doctor",
  orgWide: true,
  createSchema: schema,
  orderBy: [{ name: "asc" }],
  searchFields: ["name", "specialization", "phone"],
  filters: (sp) => (sp.get("active") === "1" ? [{ isActive: true }] : []),
});
