import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  formatWelcomeMessage,
  isTelegramConfigured,
  sendTelegramMessage,
} from "@/lib/telegram/bot";

interface TelegramUpdate {
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; type: string };
    from?: { id: number; username?: string; first_name?: string };
  };
}

export async function POST(request: NextRequest) {
  if (!isTelegramConfigured()) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const header = request.headers.get("x-telegram-bot-api-secret-token");
    if (header !== secret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const update = (await request.json()) as TelegramUpdate;
  const message = update.message;

  if (!message?.text || !message.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = message.text.trim();

  if (text === "/start" || text.startsWith("/start ")) {
    await sendTelegramMessage(chatId, formatWelcomeMessage(chatId));
    return NextResponse.json({ ok: true });
  }

  if (text === "/help") {
    await sendTelegramMessage(
      chatId,
      [
        "<b>Auto-CRM Bot</b>",
        "",
        "/start — получить Chat ID",
        "/link — привязать Telegram к аккаунту CRM",
        "/help — справка",
      ].join("\n"),
    );
    return NextResponse.json({ ok: true });
  }

  if (text === "/link" || text.startsWith("/link ")) {
    const email = text.replace("/link", "").trim();

    if (!email) {
      await sendTelegramMessage(
        chatId,
        "Отправьте: <code>/link ваш@email.com</code>\n\nEmail должен совпадать с аккаунтом в CRM.",
      );
      return NextResponse.json({ ok: true });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      await sendTelegramMessage(chatId, "Пользователь с таким email не найден.");
      return NextResponse.json({ ok: true });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { telegramChatId: chatId },
    });

    await sendTelegramMessage(
      chatId,
      `✅ Аккаунт <b>${user.name}</b> привязан.\nУведомления CRM включены.`,
    );

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
