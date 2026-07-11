import { getDealManagerIds } from "@/lib/deal-managers";
import { withAuth, assertAllowed, assertFound } from "@/lib/api-handler";
import { created, ok } from "@/lib/api-response";
import { canCommentOnDeal, isAssignedDealManager, ROLES } from "@/lib/permissions";
import { canUserViewDeal } from "@/lib/services/deal-access";
import { createComment, listComments } from "@/lib/services/comments";
import { getDeal } from "@/lib/services/deals";
import { notifyCommentAdded } from "@/lib/services/notifications";
import { serialize } from "@/lib/serialize";
import { createCommentSchema } from "@/lib/validators/comment";

export const GET = withAuth(async (_request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id));

  if (!(await canUserViewDeal(user, deal))) {
    assertAllowed(false);
  }

  const comments = await listComments(params.id);
  return ok(serialize(comments));
});

export const POST = withAuth(async (request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id));
  assertAllowed(canCommentOnDeal(user.role, user.id, deal));

  if (user.role === ROLES.MANAGER && !isAssignedDealManager(user.id, getDealManagerIds(deal))) {
    assertAllowed(false);
  }

  const body = createCommentSchema.parse(await request.json());
  const comment = await createComment({
    dealId: params.id,
    authorId: user.id,
    text: body.text,
  });

  await notifyCommentAdded({
    dealId: params.id,
    deal: {
      clientName: deal.clientName,
      vin: deal.vin,
      managerId: deal.managerId,
      managerIds: deal.managerIds,
      clientUserId: deal.clientUserId,
    },
    author: user,
    commentText: body.text,
  });

  return created(serialize(comment));
});
