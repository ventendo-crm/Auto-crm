import { withAuth, assertAllowed, assertFound } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { canUserViewDeal } from "@/lib/services/deal-access";
import { getDeal } from "@/lib/services/deals";
import { listStageHistory } from "@/lib/services/stage-history";
import { serialize } from "@/lib/serialize";

export const GET = withAuth(async (_request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id));

  if (!(await canUserViewDeal(user, deal))) {
    assertAllowed(false);
  }

  const history = await listStageHistory(params.id);
  return ok(serialize(history));
});
