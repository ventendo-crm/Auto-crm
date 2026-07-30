import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  formatWelcomeMessage,
  sendTelegramMessageWithToken,
} from "@/lib/telegram/bot";

interface TelegramUpdate {
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; type: string };
    from?: { id: number; username?: string; first_name?: string };
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await context.params;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      telegramBotToken: true,
      telegramWebhookSecret: true,
      telegramBotName: true,
    },
  });

  if (!company?.telegramBotToken) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  if (company.telegramWebhookSecret) {
    const header = request.headers.get("x-telegram-bot-api-secret-token");
    if (header !== company.telegramWebhookSecret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const token = company.telegramBotToken;
  const update = (await request.json()) as TelegramUpdate;
  const message = update.message;

  if (!message?.text || !message.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = message.text.trim();

  const send = (body: string) => sendTelegramMessageWithToken(token, chatId, body);

  if (text === "/start" || text.startsWith("/start ")) {
    await send(formatWelcomeMessage(chatId, company.telegramBotName));
    return NextResponse.json({ ok: true });
  }

  if (text === "/help") {
    await send(
      [
        `<b>${company.telegramBotName || "Auto-CRM Bot"}</b>`,
        "",
        "/start — получить Chat ID",
        "/link — привязать Telegram к аккаунту CRM",
        "/help — справка",
      ].join("\n"),
    );
    return NextResponse.json({ ok: true });
  }

  if (text === "/link" || text.startsWith("/link ")) {
    const email = text.replace("/link", "").trim().toLowerCase();

    if (!email) {
      await send(
        "Отправьте: <code>/link ваш@email.com</code>\n\nEmail должен совпадать с аккаунтом в CRM.",
      );
      return NextResponse.json({ ok: true });
    }

    const user = await prisma.user.findUnique({
      where: { companyId_email: { companyId: company.id, email } },
    });

    if (!user) {
      await send("Пользователь с таким email не найден в вашей компании.");
      return NextResponse.json({ ok: true });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { telegramChatId: chatId },
    });

    await send(`✅ Аккаунт <b>${user.name}</b> привязан.\nУведомления CRM включены.`);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
