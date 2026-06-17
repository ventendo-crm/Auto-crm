import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { markNotificationRead } from "@/lib/services/notifications";
import { serialize } from "@/lib/serialize";

export const PATCH = withAuth(async (_request, { user, params }) => {
  const notification = await markNotificationRead(user.id, params.id);
  return ok(serialize(notification));
});
