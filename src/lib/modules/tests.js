import { z } from "zod";
import { createCrud } from "@/lib/crud";
import { parametersCreate } from "@/lib/test-defaults";
import { money, opt, optNum, optUuid, req } from "@/lib/http";

const parameterSchema = z.object({
  name: req(1, 120, "Parameter name"),
  unit: opt(30),
  refLow: optNum,
  refHigh: optNum,
  refRangeText: opt(150),
});

const parametersField = z.array(parameterSchema).max(100).optional();

const schema = z
  .object({
    branchId: optUuid,
    code: req(2, 30, "Test code").transform((v) => v.toUpperCase()),
    name: req(2, 150, "Test name"),
    category: opt(80),
    sampleType: req(2, 40, "Sample type").default("Blood"),
    price: money,
    unit: opt(30),
    refLow: optNum,
    refHigh: optNum,
    refRangeText: opt(150),
    turnaroundHours: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).max(2000).nullable()).optional(),
    parameters: parametersField,
    isActive: z.boolean().default(true),
  })
  .refine((v) => v.refLow == null || v.refHigh == null || v.refLow <= v.refHigh, {
    message: "Reference low value cannot be greater than the high value.",
    path: ["refLow"],
  });

export const tests = createCrud({
  model: "test",
  label: "Test",
  dependents: ["orderItems"],
  cacheTtlMs: 20_000,
  orgWide: true,
  createSchema: schema,
  updateSchema: z.object({
    code: req(2, 30, "Test code").transform((v) => v.toUpperCase()).optional(),
    name: req(2, 150, "Test name").optional(),
    category: opt(80),
    sampleType: req(2, 40, "Sample type").optional(),
    price: money.optional(),
    unit: opt(30),
    refLow: optNum,
    refHigh: optNum,
    refRangeText: opt(150),
    turnaroundHours: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).max(2000).nullable()).optional(),
    parameters: parametersField,
    isActive: z.boolean().optional(),
  }),
  orderBy: [{ name: "asc" }],
  include: { branch: { select: { id: true, name: true, code: true } }, parameters: { orderBy: { sortOrder: "asc" } } },
  beforeCreate: async (_ctx, data) => {
    const { parameters, ...rest } = data;
    return parameters?.length ? { ...rest, parameters: { create: parametersCreate(parameters) } } : rest;
  },
  beforeUpdate: (data) => {
    const { parameters, ...rest } = data;
    return parameters === undefined ? rest : { ...rest, parameters: { deleteMany: {}, create: parametersCreate(parameters) } };
  },
  searchFields: ["name", "code", "category"],
  filters: (sp) => (sp.get("active") === "1" ? [{ isActive: true }] : []),
  conflictMessage: "A test with this code already exists in your organization.",
});
