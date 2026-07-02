import { assertAllowed, assertFound, withAuth } from "@/lib/api-handler";
import { noContent, ok } from "@/lib/api-response";
import { canClearDealHistory } from "@/lib/permissions";
import { canUserViewDeal } from "@/lib/services/deal-access";
import { clearDealHistory, listDealActivity } from "@/lib/services/deal-activity";
import { getDeal } from "@/lib/services/deals";

export const GET = withAuth(async (_request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id));

  if (!(await canUserViewDeal(user, deal))) {
    assertAllowed(false);
  }

  const activity = await listDealActivity(params.id);
  return ok(activity);
});

export const DELETE = withAuth(async (_request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id));

  assertAllowed(canClearDealHistory(user.role, user.id, deal.managerId));

  await clearDealHistory(params.id);
  return noContent();
});