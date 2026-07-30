import { withAuth, assertAllowed } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canManageUsers } from "@/lib/permissions";
import { TELEGRAM_TEMPLATE_PLACEHOLDERS } from "@/lib/telegram/templates";
import { updateTelegramTemplate } from "@/lib/telegram/template-store";
import { serialize } from "@/lib/serialize";
import {
  telegramTemplateKeySchema,
  updateTelegramTemplateSchema,
} from "@/lib/validators/telegram-templates";

export const PATCH = withAuth(async (request, { user, params }) => {
  assertAllowed(canManageUsers(user.role));

  const keyResult = telegramTemplateKeySchema.safeParse(params.key);
  if (!keyResult.success) {
    return error("Неизвестный шаблон", 404);
  }

  const body = updateTelegramTemplateSchema.parse(await request.json());

  const template = await updateTelegramTemplate(keyResult.data, {
    ...body,
    updatedById: user.id,
  });

  return ok(
    serialize({
      ...template,
      placeholders: TELEGRAM_TEMPLATE_PLACEHOLDERS[keyResult.data],
    }),
  );
});
