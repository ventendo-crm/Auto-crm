import { assertAllowed, withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canAccessCalculator, canManageCompanyCalculator } from "@/lib/permissions";
import {
  addCompanyCustomOrigin,
  getCompanyCalculatorSettings,
  removeCompanyCustomOrigin,
  saveCompanyCalculatorExpenses,
} from "@/lib/services/company-calculator-settings";
import { saveCompanyCalculatorExpensesSchema } from "@/lib/validators/company-calculator-settings";
import { z } from "zod";

export const GET = withAuth(async (_request, { user }) => {
  assertAllowed(canAccessCalculator(user.role));
  const settings = await getCompanyCalculatorSettings(user.companyId);
  return ok(settings);
});

export const PUT = withAuth(async (request, { user }) => {
  assertAllowed(canManageCompanyCalculator(user.role));
  const body = saveCompanyCalculatorExpensesSchema.parse(await request.json());
  const settings = await saveCompanyCalculatorExpenses(
    user.companyId,
    body.expenseItems,
    body.customOrigins,
  );
  return ok(settings);
});

const addOriginSchema = z.object({
  label: z.string().trim().min(1, "Укажите название страны").max(80),
  inputCurrency: z.enum(["RUB", "USD", "CNY", "KRW"]).optional(),
});

export const POST = withAuth(async (request, { user }) => {
  assertAllowed(canManageCompanyCalculator(user.role));
  const body = addOriginSchema.parse(await request.json());
  try {
    return ok(
      await addCompanyCustomOrigin(user.companyId, body.label, body.inputCurrency ?? "CNY"),
    );
  } catch (err) {
    return error(err instanceof Error ? err.message : "Не удалось добавить страну", 400);
  }
});
