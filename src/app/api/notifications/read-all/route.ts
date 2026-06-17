import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { markAllNotificationsRead } from "@/lib/services/notifications";

export const POST = withAuth(async (_request, { user }) => {
  const count = await markAllNotificationsRead(user.id);
  return ok({ updated: count });
});
