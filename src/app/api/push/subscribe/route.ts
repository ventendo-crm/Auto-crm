import { withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { isPushConfigured } from "@/lib/push/vapid";
import {
  removeAllPushSubscriptions,
  removePushSubscription,
  upsertPushSubscription,
} from "@/lib/services/push-subscriptions";
import { pushSubscribeSchema, pushUnsubscribeSchema } from "@/lib/validators/push";

export const POST = withAuth(async (request, { user }) => {
  if (!isPushConfigured()) {
    return error("Браузерные уведомления не настроены на сервере", 503);
  }

  const body = pushSubscribeSchema.parse(await request.json());
  const userAgent = request.headers.get("user-agent");

  const subscription = await upsertPushSubscription({
    userId: user.id,
    endpoint: body.endpoint,
    p256dh: body.p256dh,
    auth: body.auth,
    userAgent,
  });

  return ok({ id: subscription.id });
});

export const DELETE = withAuth(async (request, { user }) => {
  const body = await request.json().catch(() => ({}));
  const parsed = pushUnsubscribeSchema.safeParse(body);

  if (parsed.success) {
    try {
      await removePushSubscription(user.id, parsed.data.endpoint);
      return ok({ removed: 1 });
    } catch {
      return error("Подписка не найдена", 404);
    }
  }

  const removed = await removeAllPushSubscriptions(user.id);
  return ok({ removed });
});
