import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createCrud } from "@/lib/crud";
import { money, opt, optUuid, req } from "@/lib/http";

export const EXPENSE_METHODS = ["CASH", "CARD", "BANK_TRANSFER", "ONLINE", "CHEQUE"];

const schema = z.object({
  branchId: optUuid,
  category: req(2, 80, "Category"),
  description: opt(300),
  amount: money.refine((v) => v > 0, "Amount must be greater than zero."),
  paymentMethod: z.enum(EXPENSE_METHODS, { message: "Select a valid payment method." }).default("CASH"),
  expenseDate: z.coerce
    .date({ message: "Valid date is required." })
    .refine((d) => d.getTime() <= Date.now() + 86_400_000, "Expense date cannot be in the future."),
});

const day = (v) => {
  const d = v ? new Date(`${v}T00:00:00.000Z`) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

export const expenses = createCrud({
  model: "expense",
  label: "Expense",
  createSchema: schema,
  orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
  searchFields: ["category", "description", "createdByName"],
  filters: (sp) => {
    const out = [];
    const from = day(sp.get("from"));
    const to = day(sp.get("to"));
    if (from) out.push({ expenseDate: { gte: from } });
    if (to) out.push({ expenseDate: { lte: to } });
    const method = sp.get("paymentMethod");
    if (EXPENSE_METHODS.includes(method)) out.push({ paymentMethod: method });
    const category = (sp.get("category") || "").trim().slice(0, 80);
    if (category) out.push({ category: { equals: category, mode: "insensitive" } });
    return out;
  },
  // Totals for the whole filtered result (not just the visible page) and the category list for the filter.
  extra: async (where) => {
    const [agg, cats] = await Promise.all([
      prisma.expense.aggregate({ where, _sum: { amount: true }, _count: true }),
      prisma.expense.groupBy({ by: ["category"], where: { organizationId: where.AND?.[0]?.organizationId }, orderBy: { category: "asc" }, take: 100 }),
    ]);
    return { totalAmount: Number(agg._sum.amount || 0), categories: cats.map((c) => c.category) };
  },
  beforeCreate: async ({ actor }, data) => ({ ...data, createdByName: actor.name }),
});
