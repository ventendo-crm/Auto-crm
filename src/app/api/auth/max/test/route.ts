import { withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import {
  getCompanyMaxConfig,
  isCompanyMaxConfigured,
  sendTestMaxNotification,
} from "@/lib/max/bot";

export const POST = withAuth(async (_request, { user }) => {
  const config = await getCompanyMaxConfig(user.companyId);
  if (!isCompanyMaxConfigured(config)) {
    return error("MAX не настроен: привяжите бота компании в Настройки → Мессенджеры", 503);
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { maxUserId: true, name: true },
  });

  if (!account?.maxUserId) {
    return error("Сначала привяжите MAX в профиле или через /link в боте", 400);
  }

  const result = await sendTestMaxNotification({
    companyId: user.companyId,
    userId: account.maxUserId,
    userName: account.name,
  });

  if (!result.ok) {
    return error(result.error ?? "Не удалось отправить сообщение в MAX", 502);
  }

  return ok({ delivered: true, userId: account.maxUserId });
});
