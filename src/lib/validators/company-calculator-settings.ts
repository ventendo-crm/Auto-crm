import { z } from "zod";

export const calculatorExpenseItemSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().trim().min(1, "Укажите название").max(120),
  defaultAmount: z.number().finite().min(0).max(1_000_000_000),
  currency: z.enum(["RUB", "USD", "CNY", "KRW"]),
  origin: z.enum(["all", "china", "korea", "kyrgyzstan"]),
  role: z.enum([
    "china_local",
    "city_delivery",
    "korea_parking",
    "korea_docs",
    "broker",
    "delivery",
    "delivery_usd",
    "escort",
    "extra",
  ]),
  sortOrder: z.number().int().min(0).max(10_000),
});

export const saveCompanyCalculatorExpensesSchema = z.object({
  expenseItems: z.array(calculatorExpenseItemSchema).max(100),
});

export type CalculatorExpenseItemInput = z.infer<typeof calculatorExpenseItemSchema>;
