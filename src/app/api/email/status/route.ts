import { withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { isEmailConfigured } from "@/lib/email/config";
import { ROLES } from "@/lib/permissions";

export const GET = withAuth(async (_request, { user }) => {
  if (user.role !== ROLES.CLIENT) {
    return error("Статус email доступен для клиентского аккаунта", 403);
  }

  return ok({ configured: isEmailConfigured() });
});
