import { withAuth, assertAllowed, assertFound } from "@/lib/api-handler";
import { error, noContent } from "@/lib/api-response";
import { canDeleteCustomsEstimates } from "@/lib/permissions";
import { deleteDealCustomsEstimate } from "@/lib/services/deal-customs-estimates";
import { getDeal } from "@/lib/services/deals";

export const DELETE = withAuth(async (_request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id, user.companyId));

  if (!canDeleteCustomsEstimates(user.role, user.id, deal)) {
    assertAllowed(false);
  }

  try {
    await deleteDealCustomsEstimate(user, params.id, params.estimateId);
    return noContent();
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return error("Расчёт не найден", 404);
    }
    throw err;
  }
});
