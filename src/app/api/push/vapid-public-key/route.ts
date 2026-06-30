import { withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { getVapidPublicKey, isPushConfigured } from "@/lib/push/vapid";

export const GET = withAuth(async () => {
  if (!isPushConfigured()) {
    return error("Браузерные уведомления не настроены на сервере (VAPID ключи)", 503);
  }

  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return error("Браузерные уведомления не настроены на сервере (VAPID ключи)", 503);
  }

  return ok({ publicKey });
});
