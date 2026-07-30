import { withAuth, assertAllowed } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { canManageUsers } from "@/lib/permissions";
import { TELEGRAM_TEMPLATE_PLACEHOLDERS } from "@/lib/telegram/templates";
import { listTelegramTemplates } from "@/lib/telegram/template-store";
import { serialize } from "@/lib/serialize";

export const GET = withAuth(async (_request, { user }) => {
  assertAllowed(canManageUsers(user.role));

  const templates = await listTelegramTemplates();
  return ok(
    serialize(
      templates.map((template) => ({
        ...template,
        placeholders: TELEGRAM_TEMPLATE_PLACEHOLDERS[template.key],
      })),
    ),
  );
});
