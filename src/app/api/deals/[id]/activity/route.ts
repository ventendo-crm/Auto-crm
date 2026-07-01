import { assertAllowed, assertFound, withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { canUserViewDeal } from "@/lib/services/deal-access";
import { listDealActivity } from "@/lib/services/deal-activity";
import { getDeal } from "@/lib/services/deals";

export const GET = withAuth(async (_request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id));

  if (!(await canUserViewDeal(user, deal))) {
    assertAllowed(false);
  }

  const activity = await listDealActivity(params.id);
  return ok(activity);
});