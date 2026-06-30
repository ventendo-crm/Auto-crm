import { withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { isFcmConfigured } from "@/lib/push/fcm";
import { removeFcmDevice, upsertFcmDevice } from "@/lib/services/fcm-devices";
import { fcmSubscribeSchema, fcmUnsubscribeSchema } from "@/lib/validators/fcm";

export const POST = withAuth(async (request, { user }) => {
  if (!isFcmConfigured()) {
    return error("FCM не настроен на сервере (FIREBASE_SERVICE_ACCOUNT_JSON)", 503);
  }

  const body = fcmSubscribeSchema.parse(await request.json());
  const userAgent = request.headers.get("user-agent");

  const device = await upsertFcmDevice({
    userId: user.id,
    token: body.token,
    label: body.label ?? userAgent,
  });

  return ok({ id: device.id });
});

export const DELETE = withAuth(async (request, { user }) => {
  const body = fcmUnsubscribeSchema.parse(await request.json());

  try {
    await removeFcmDevice(user.id, body.token);
    return ok({ removed: true });
  } catch {
    return error("Устройство не найдено", 404);
  }
});
