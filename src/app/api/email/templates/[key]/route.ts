import { withAuth, assertAllowed } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { EMAIL_TEMPLATE_PLACEHOLDERS } from "@/lib/email/templates";
import { updateEmailTemplate } from "@/lib/email/template-store";
import { canManageUsers } from "@/lib/permissions";
import { serialize } from "@/lib/serialize";
import {
  emailTemplateKeySchema,
  updateEmailTemplateSchema,
} from "@/lib/validators/email-templates";

export const PATCH = withAuth(async (request, { user, params }) => {
  assertAllowed(canManageUsers(user.role));

  const keyResult = emailTemplateKeySchema.safeParse(params.key);
  if (!keyResult.success) {
    return error("Неизвестный шаблон", 404);
  }

  const body = updateEmailTemplateSchema.parse(await request.json());

  const template = await updateEmailTemplate(keyResult.data, {
    ...body,
    updatedById: user.id,
  });

  return ok(
    serialize({
      ...template,
      placeholders: EMAIL_TEMPLATE_PLACEHOLDERS[keyResult.data],
    }),
  );
});
