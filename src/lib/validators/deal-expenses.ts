import { z } from "zod";

const expenseAmount = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid amount" });
    return z.NEVER;
  }
  return parsed;
});

export const dealExpenseItemSchema = z.object({
  description: z.string().max(500),
  amount: expenseAmount,
});

export const replaceDealExpensesSchema = z.object({
  expenses: z.array(dealExpenseItemSchema),
});
