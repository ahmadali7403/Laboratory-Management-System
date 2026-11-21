import { z } from "zod";
import { createCrud } from "@/lib/crud";
import { money, opt, optUuid, req } from "@/lib/http";

const schema = z.object({
  branchId: optUuid,
  category: req(2, 80, "Category"),
  description: opt(300),
  amount: money.refine((v) => v > 0, "Amount must be greater than zero."),
  expenseDate: z.coerce.date({ message: "Valid date is required." }),
});

export const expenses = createCrud({
  model: "expense",
  label: "Expense",
  createSchema: schema,
  orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
  searchFields: ["category", "description"],
  beforeCreate: async ({ actor }, data) => ({ ...data, createdByName: actor.name }),
});
