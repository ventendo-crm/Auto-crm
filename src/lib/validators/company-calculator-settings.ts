import { z } from "zod";
import { CUSTOM_ORIGIN_ID_RE } from "@/lib/customs-calculator/custom-origins";
import { isSystemOriginCountry } from "@/lib/customs-calculator/rates";

const expenseOriginSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(
    (value) =>
      value === "all" ||
      isSystemOriginCountry(value) ||
      CUSTOM_ORIGIN_ID_RE.test(value),
    { message: "Некорректная страна поля расходов" },
  );

export const calculatorExpenseItemSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().trim().min(1, "Укажите название").max(120),
  defaultAmount: z.number().finite().min(0).max(1_000_000_000),
  currency: z.enum(["RUB", "USD", "CNY", "KRW"]),
  origin: expenseOriginSchema,
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

export const customCalculatorOriginSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(CUSTOM_ORIGIN_ID_RE, "ID страны должен начинаться с custom_"),
  label: z.string().trim().min(1, "Укажите название страны").max(80),
  calcProfile: z.literal("china"),
  inputCurrency: z.enum(["RUB", "USD", "CNY", "KRW"]).optional(),
});

export const saveCompanyCalculatorExpensesSchema = z.object({
  expenseItems: z.array(calculatorExpenseItemSchema).max(100),
  customOrigins: z.array(customCalculatorOriginSchema).max(50).optional(),
});

export type CalculatorExpenseItemInput = z.infer<typeof calculatorExpenseItemSchema>;
export type CustomCalculatorOriginInput = z.infer<typeof customCalculatorOriginSchema>;
