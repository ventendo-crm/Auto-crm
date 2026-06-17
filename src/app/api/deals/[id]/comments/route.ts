import { withAuth, assertAllowed, assertFound } from "@/lib/api-handler";
import { created, ok } from "@/lib/api-response";
import { canCommentOnDeal, canViewDeal, ROLES } from "@/lib/permissions";
import { createComment, listComments } from "@/lib/services/comments";
import { getDeal } from "@/lib/services/deals";
import { serialize } from "@/lib/serialize";
import { createCommentSchema } from "@/lib/validators/comment";

export const GET = withAuth(async (_request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id));

  if (!canViewDeal(user.role, user.id, deal)) {
    assertAllowed(false);
  }

  const comments = await listComments(params.id);
  return ok(serialize(comments));
});

export const POST = withAuth(async (request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id));
  assertAllowed(canCommentOnDeal(user.role, user.id, deal));

  if (user.role === ROLES.MANAGER && deal.managerId !== user.id) {
    assertAllowed(false);
  }

  const body = createCommentSchema.parse(await request.json());
  const comment = await createComment({
    dealId: params.id,
    authorId: user.id,
    text: body.text,
  });

  return created(serialize(comment));
});
