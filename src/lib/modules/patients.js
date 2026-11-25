import { z } from "zod";
import { createCrud } from "@/lib/crud";
import { nextNumber } from "@/lib/sequence";
import { opt, optDate, optUuid } from "@/lib/http";
import { cnicField, optPersonName, personName, phoneField } from "@/lib/validators";
import { prisma } from "@/lib/prisma";

const patientSchema = z.object({
  branchId: optUuid,
  name: personName("Patient name"),
  fatherName: optPersonName(120),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).default("OTHER"),
  dateOfBirth: optDate,
  phone: phoneField,
  email: z.string().trim().email("Invalid email address.").max(120).nullish().or(z.literal("")).transform((v) => v || null),
  cnic: cnicField,
  address: opt(300),
  notes: opt(500),
});

// A CNIC identifies one person inside an organization.
async function cnicTaken(organizationId, cnic, exceptId) {
  if (!cnic) return false;
  const hit = await prisma.patient.findFirst({
    where: { organizationId, cnic, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  return Boolean(hit);
}

export const patients = createCrud({
  model: "patient",
  label: "Patient",
  dependents: ["orders"],
  createSchema: patientSchema,
  searchFields: ["name", "mrn", "phone", "cnic"],
  beforeCreate: async ({ tx, target }, data) => {
    if (await cnicTaken(target.organizationId, data.cnic)) {
      const e = new Error("DUP_CNIC"); e.userMessage = "A patient with this CNIC already exists."; throw e;
    }
    return {
    ...data,
    mrn: await nextNumber(tx, target.organizationId, "patient", "MRN"),
    };
  },
  beforeUpdate: async (data, existing) => {
    if (data.cnic && (await cnicTaken(existing.organizationId, data.cnic, existing.id))) {
      const e = new Error("DUP_CNIC"); e.userMessage = "A patient with this CNIC already exists."; throw e;
    }
    return data;
  },
});
