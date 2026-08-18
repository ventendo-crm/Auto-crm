import { withAuth, assertFound } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { getDeal } from "@/lib/services/deals";
import { recalculateAllSearchProcessEstimates } from "@/lib/services/search-process-entry-estimates";
import { serialize } from "@/lib/serialize";

export const POST = withAuth(async (_request, { user, params }) => {
  assertFound(await getDeal(params.id, user.companyId));
  const result = await recalculateAllSearchProcessEstimates(user, params.id);
  return ok(serialize(result));
});
