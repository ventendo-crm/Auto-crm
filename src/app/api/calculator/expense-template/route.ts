import { assertAllowed, withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { canAccessCalculator, canManageCompanyCalculator } from "@/lib/permissions";
import {
  getCompanyCalculatorSettings,
  saveCompanyCalculatorExpenses,
} from "@/lib/services/company-calculator-settings";
import { saveCompanyCalculatorExpensesSchema } from "@/lib/validators/company-calculator-settings";

export const GET = withAuth(async (_request, { user }) => {
  assertAllowed(canAccessCalculator(user.role));
  const settings = await getCompanyCalculatorSettings(user.companyId);
  return ok(settings);
});

export const PUT = withAuth(async (request, { user }) => {
  assertAllowed(canManageCompanyCalculator(user.role));
  const body = saveCompanyCalculatorExpensesSchema.parse(await request.json());
  const settings = await saveCompanyCalculatorExpenses(user.companyId, body.expenseItems);
  return ok(settings);
});
