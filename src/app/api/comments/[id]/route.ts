import { withAuth, assertAllowed, assertFound } from "@/lib/api-handler";
import { noContent, ok } from "@/lib/api-response";
import { canModifyComment } from "@/lib/permissions";
import { canUserViewDeal } from "@/lib/services/deal-access";
import { deleteComment, getComment, updateComment } from "@/lib/services/comments";
import { serialize } from "@/lib/serialize";
import { updateCommentSchema } from "@/lib/validators/comment";

export const GET = withAuth(async (_request, { user, params }) => {
  const comment = assertFound(await getComment(params.id));

  if (!(await canUserViewDeal(user, comment.deal))) {
    assertAllowed(false);
  }

  const { deal: _deal, ...rest } = comment;
  return ok(serialize(rest));
});

export const PATCH = withAuth(async (request, { user, params }) => {
  const comment = assertFound(await getComment(params.id));
  assertAllowed(canModifyComment(user.role, user.id, comment.authorId));

  const body = updateCommentSchema.parse(await request.json());
  const updated = await updateComment(params.id, user.id, body.text);

  return ok(serialize(updated));
});

export const DELETE = withAuth(async (_request, { user, params }) => {
  const comment = assertFound(await getComment(params.id));
  assertAllowed(canModifyComment(user.role, user.id, comment.authorId));

  await deleteComment(params.id, user.id);
  return noContent();
});
