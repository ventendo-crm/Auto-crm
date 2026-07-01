import { withAuth, assertAllowed, assertFound } from "@/lib/api-handler";
import { noContent, ok } from "@/lib/api-response";
import {
  canDeleteDeal,
  canUpdateDeal,
} from "@/lib/permissions";
import { canUserViewDeal } from "@/lib/services/deal-access";
import { deleteDeal, getDeal, updateDeal } from "@/lib/services/deals";
import { listDealMedia } from "@/lib/services/media";
import { serialize } from "@/lib/serialize";
import { updateDealSchema } from "@/lib/validators/deal";

export const GET = withAuth(async (_request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id));

  if (!(await canUserViewDeal(user, deal))) {
    assertAllowed(false);
  }

  const media = await listDealMedia(user, params.id);

  return ok(serialize({ ...deal, media }));
});

export const PATCH = withAuth(async (request, { user, params }) => {
  const existing = assertFound(await getDeal(params.id));
  assertAllowed(canUpdateDeal(user.role, user.id, existing.managerId));

  const body = updateDealSchema.parse(await request.json());
  const deal = await updateDeal(user, params.id, body);

  return ok(serialize(deal));
});

export const DELETE = withAuth(async (_request, { user, params }) => {
  const existing = assertFound(await getDeal(params.id));
  assertAllowed(canDeleteDeal(user.role, user.id, existing.managerId));

  await deleteDeal(user, existing.id);

  return noContent();
});
