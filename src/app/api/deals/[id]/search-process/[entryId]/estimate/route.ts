import { withAuth, assertFound } from "@/lib/api-handler";
import { noContent, ok } from "@/lib/api-response";
import { getDeal } from "@/lib/services/deals";
import {
  deleteSearchProcessEntryEstimate,
  getSearchProcessEntryEstimate,
  upsertSearchProcessEntryEstimate,
} from "@/lib/services/search-process-entry-estimates";
import { serialize } from "@/lib/serialize";
import { upsertVariantCustomsEstimateSchema } from "@/lib/validators/variant-customs-estimate";

export const GET = withAuth(async (_request, { user, params }) => {
  assertFound(await getDeal(params.id, user.companyId));
  const data = await getSearchProcessEntryEstimate(params.id, params.entryId);
  return ok(serialize(data));
});

export const PUT = withAuth(async (request, { user, params }) => {
  assertFound(await getDeal(params.id, user.companyId));
  const body = upsertVariantCustomsEstimateSchema.parse(await request.json());
  const data = await upsertSearchProcessEntryEstimate(user, params.id, params.entryId, body);
  return ok(serialize(data));
});

export const DELETE = withAuth(async (_request, { user, params }) => {
  assertFound(await getDeal(params.id, user.companyId));
  await deleteSearchProcessEntryEstimate(user, params.id, params.entryId);
  return noContent();
});
