import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { listNotifications } from "@/lib/services/notifications";
import { serialize } from "@/lib/serialize";
import { listNotificationsSchema } from "@/lib/validators/notification";

export const GET = withAuth(async (request, { user }) => {
  const { searchParams } = new URL(request.url);
  const filters = listNotificationsSchema.parse({
    read: searchParams.get("read") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  const result = await listNotifications(user.id, filters);
  return ok(serialize(result));
});
