import { withAuth, assertAllowed } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { canManageUsers } from "@/lib/permissions";
import {
  listClientStageMessages,
  updateClientStageMessages,
} from "@/lib/services/client-stage-messages";
import { serialize } from "@/lib/serialize";
import { updateClientStageMessagesSchema } from "@/lib/validators/client-stage-messages";

export const GET = withAuth(async (_request, { user }) => {
  assertAllowed(canManageUsers(user.role));
  return ok(serialize(await listClientStageMessages(user.companyId)));
});

export const PUT = withAuth(async (request, { user }) => {
  assertAllowed(canManageUsers(user.role));
  const body = updateClientStageMessagesSchema.parse(await request.json());
  const messages = await updateClientStageMessages(user.companyId, body.messages, user.id);
  return ok(serialize(messages));
});
