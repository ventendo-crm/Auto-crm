import { withAuth, assertAllowed, assertFound } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { ROLES } from "@/lib/permissions";
import { getClientPortalDeal } from "@/lib/services/client-account";

export const GET = withAuth(async (_request, { user }) => {
  if (user.role !== ROLES.CLIENT) {
    assertAllowed(false);
  }

  const deal = assertFound(await getClientPortalDeal(user.id));
  return ok(deal);
});
