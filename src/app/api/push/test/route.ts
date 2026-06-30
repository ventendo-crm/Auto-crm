import { withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { isPushConfigured } from "@/lib/push/vapid";
import { sendTestBrowserPush } from "@/lib/push/send";

export const POST = withAuth(async (_request, { user }) => {
  if (!isPushConfigured()) {
    return error("Браузерные уведомления не настроены на сервере", 503);
  }

  await sendTestBrowserPush(user.id, user.name);
  return ok({ delivered: true });
});
