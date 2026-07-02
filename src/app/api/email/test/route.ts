import { withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { isEmailConfigured } from "@/lib/email/config";
import { sendEmail } from "@/lib/email/send";
import { formatTestEmail } from "@/lib/email/templates";
import { ROLES } from "@/lib/permissions";

export const POST = withAuth(async (_request, { user }) => {
  if (!isEmailConfigured()) {
    return error("Email-уведомления не настроены на сервере", 503);
  }

  if (user.role !== ROLES.CLIENT) {
    return error("Тестовое письмо доступно для клиентского аккаунта", 403);
  }

  const email = await formatTestEmail(user.name);
  const result = await sendEmail({
    to: user.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  if (!result.ok) {
    return error(result.error ?? "Не удалось отправить письмо", 502);
  }

  return ok({ delivered: true, to: result.to });
});
