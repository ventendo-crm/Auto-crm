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

/** /start, /start payload, /start@BotName payload */
function parseStartCommand(text: string): { isStart: boolean; payload: string } {
  const match = text.match(/^\/start(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]+))?$/i);
  if (!match) {
    return { isStart: false, payload: "" };
  }
  return { isStart: true, payload: (match[1] ?? "").trim() };
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

  const start = parseStartCommand(text);
  if (start.isStart) {
    const payload = start.payload;

    if (payload.startsWith("link_")) {
      const linkToken = payload.slice("link_".length).trim();
      if (!linkToken) {
        await send("Ссылка приглашения неполная. Попросите менеджера прислать новую.");
        return NextResponse.json({ ok: true });
      }

      const user = await prisma.user.findFirst({
        where: {
          companyId: company.id,
          telegramLinkToken: linkToken,
        },
        select: {
          id: true,
          name: true,
          telegramChatId: true,
          telegramLinkTokenExpiresAt: true,
        },
      });

      if (!user) {
        // Возможно, ссылка уже использована этим же чатом
        const alreadyLinked = await prisma.user.findFirst({
          where: { companyId: company.id, telegramChatId: chatId },
          select: { id: true, name: true },
        });
        if (alreadyLinked) {
          await send(
            `✅ Аккаунт <b>${alreadyLinked.name}</b> уже привязан к этому Telegram.\nУведомления включены.`,
          );
          return NextResponse.json({ ok: true });
        }

        await send("Ссылка приглашения недействительна. Попросите менеджера прислать новую.");
        return NextResponse.json({ ok: true });
      }

      if (user.telegramLinkTokenExpiresAt && user.telegramLinkTokenExpiresAt < new Date()) {
        await send("Срок действия ссылки истёк. Попросите менеджера прислать новую.");
        return NextResponse.json({ ok: true });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          telegramChatId: chatId,
          telegramLinkToken: null,
          telegramLinkTokenExpiresAt: null,
        },
      });

      console.info(
        "[telegram-webhook] linked user",
        user.id,
        "chatId=",
        chatId,
        "companyId=",
        company.id,
      );

      await send(
        `✅ Аккаунт <b>${user.name}</b> привязан.\nУведомления по вашей сделке включены.`,
      );
      return NextResponse.json({ ok: true });
    }

    await send(formatWelcomeMessage(chatId, company.telegramBotName));
    return NextResponse.json({ ok: true });
  }

  if (text === "/help" || text.startsWith("/help@")) {
    await send(
      [
        `<b>${company.telegramBotName || "Auto-CRM Bot"}</b>`,
        "",
        "/start — получить Chat ID",
        "/link — привязать Telegram к аккаунту CRM",
        "/help — справка",
        "",
        "Удобнее: откройте ссылку-приглашение от менеджера.",
      ].join("\n"),
    );
    return NextResponse.json({ ok: true });
  }

  if (text === "/link" || text.startsWith("/link ") || text.startsWith("/link@")) {
    const email = text
      .replace(/^\/link(?:@[A-Za-z0-9_]+)?/i, "")
      .trim()
      .toLowerCase();

    if (!email) {
      await send(
        "Отправьте: <code>/link ваш@email.com</code>\n\nEmail должен совпадать с аккаунтом в CRM.\nИли откройте ссылку-приглашение от менеджера.",
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
