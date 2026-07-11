import { withAuth, assertAllowed } from "@/lib/api-handler";
import { created, ok } from "@/lib/api-response";
import { canCreateDeals } from "@/lib/permissions";
import { createDeal, listDeals } from "@/lib/services/deals";
import { serialize } from "@/lib/serialize";
import { createDealSchema, listDealsSchema } from "@/lib/validators/deal";

export const GET = withAuth(async (request, { user }) => {
  const { searchParams } = new URL(request.url);
  const filters = listDealsSchema.parse({
    stage: searchParams.get("stage") ?? undefined,
    managerId: searchParams.get("managerId") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    overdue: searchParams.get("overdue") ?? undefined,
    withClientPortal: searchParams.get("withClientPortal") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  const result = await listDeals(user, filters);
  return ok(serialize(result));
});

export const POST = withAuth(async (request, { user }) => {
  assertAllowed(canCreateDeals(user.role));

  const body = createDealSchema.parse(await request.json());
  const deal = await createDeal(user, body);

  return created(serialize(deal));
});
