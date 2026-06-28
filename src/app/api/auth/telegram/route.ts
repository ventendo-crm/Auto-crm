import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { isTelegramConfigured, sendTelegramMessage } from "@/lib/telegram/bot";
import { z } from "zod";

const schema = z.object({
  telegramChatId: z.string().min(1).max(32),
});

export const PATCH = withAuth(async (request, { user }) => {
  const body = schema.parse(await request.json());

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { telegramChatId: body.telegramChatId },
    select: {
      id: true,
      name: true,
      email: true,
      telegramChatId: true,
      createdAt: true,
      role: { select: { id: true, name: true } },
    },
  });

  if (isTelegramConfigured()) {
    const delivered = await sendTelegramMessage(
      body.telegramChatId,
      "✅ <b>Auto-CRM</b>\nTelegram успешно привязан. Вы будете получать уведомления о сделках.",
    );

    if (!delivered) {
      throw new Error(
        "Chat ID сохранён, но Telegram не ответил. Проверьте ID, напишите боту /start и настройки сервера.",
      );
    }
  }

  return ok(serialize(updated));
});

export const DELETE = withAuth(async (_request, { user }) => {
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { telegramChatId: null },
    select: {
      id: true,
      name: true,
      email: true,
      telegramChatId: true,
      createdAt: true,
      role: { select: { id: true, name: true } },
    },
  });

  return ok(serialize(updated));
});
