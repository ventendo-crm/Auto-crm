import { withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { isEmailConfigured } from "@/lib/email/config";
import { ROLES } from "@/lib/permissions";

export const GET = withAuth(async (_request, { user }) => {
  // Статус SMTP нужен и клиенту (уведомления), и админу (проверка настройки).
  if (user.role === ROLES.VIEWER) {
    return error("Forbidden", 403);
  }

  return ok({ configured: isEmailConfigured() });
});
