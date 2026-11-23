import { z } from "zod";
import { createCrud } from "@/lib/crud";
import { nextNumber } from "@/lib/sequence";
import { opt, optDate, optUuid, req } from "@/lib/http";

const patientSchema = z.object({
  branchId: optUuid,
  name: req(2, 120, "Patient name"),
  fatherName: opt(120),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).default("OTHER"),
  dateOfBirth: optDate,
  phone: opt(30),
  email: z.string().trim().email("Invalid email address.").max(120).nullish().or(z.literal("")).transform((v) => v || null),
  cnic: opt(20),
  address: opt(300),
  notes: opt(500),
});

export const patients = createCrud({
  model: "patient",
  label: "Patient",
  createSchema: patientSchema,
  searchFields: ["name", "mrn", "phone", "cnic"],
  beforeCreate: async ({ tx, target }, data) => ({
    ...data,
    mrn: await nextNumber(tx, target.organizationId, "patient", "MRN"),
  }),
});
