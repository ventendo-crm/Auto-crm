import { withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import {
  isTelegramConfigured,
  sendTestTelegramNotification,
} from "@/lib/telegram/bot";

export const POST = withAuth(async (_request, { user }) => {
  if (!isTelegramConfigured()) {
    return error("Telegram не настроен: задайте TELEGRAM_BOT_TOKEN на сервере", 503);
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { telegramChatId: true, name: true },
  });

  if (!account?.telegramChatId) {
    return error("Сначала привяжите Chat ID в профиле или через /link в боте", 400);
  }

  const result = await sendTestTelegramNotification({
    chatId: account.telegramChatId,
    userName: account.name,
  });

  if (!result.ok) {
    return error(result.error ?? "Не удалось отправить сообщение в Telegram", 502);
  }

  return ok({ delivered: true, chatId: account.telegramChatId });
});
