import { withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { assertCompanyCalculatorManageAccess } from "@/lib/services/company-workspace";
import { removeCompanyCustomOrigin } from "@/lib/services/company-calculator-settings";

export const DELETE = withAuth(async (_request, { user, params }) => {
  await assertCompanyCalculatorManageAccess(user);
  const originId = params.originId;
  if (!originId) {
    return error("Страна не указана", 400);
  }
  try {
    return ok(await removeCompanyCustomOrigin(user.companyId, originId));
  } catch (err) {
    return error(err instanceof Error ? err.message : "Не удалось удалить страну", 400);
  }
});
