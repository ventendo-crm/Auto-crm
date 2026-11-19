import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatMaxWelcomeMessage, sendMaxMessageWithToken } from "@/lib/max/bot";
import { linkClientByInviteToken } from "@/lib/services/client-account";

interface MaxUser {
  user_id?: number;
  first_name?: string;
  name?: string;
  username?: string;
}

interface MaxUpdate {
  update_type?: string;
  chat_id?: number;
  user?: MaxUser;
  payload?: string;
  message?: {
    sender?: MaxUser;
    body?: { text?: string };
    text?: string;
  };
}

function parseStartCommand(text: string): { isStart: boolean; payload: string } {
  const match = text.match(/^\/start(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]+))?$/i);
  if (!match) {
    return { isStart: false, payload: "" };
  }
  return { isStart: true, payload: (match[1] ?? "").trim() };
}

function collectUpdates(payload: unknown): MaxUpdate[] {
  if (Array.isArray(payload)) {
    return payload as MaxUpdate[];
  }
  if (payload && typeof payload === "object") {
    const record = payload as { updates?: unknown; update?: unknown };
    if (Array.isArray(record.updates)) {
      return record.updates as MaxUpdate[];
    }
    return [payload as MaxUpdate];
  }
  return [];
}

function updateUserId(update: MaxUpdate): string | null {
  const id = update.user?.user_id ?? update.message?.sender?.user_id;
  return id != null ? String(id) : null;
}

function updateText(update: MaxUpdate): string {
  return (update.message?.body?.text ?? update.message?.text ?? "").trim();
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
      maxBotToken: true,
      maxWebhookSecret: true,
      maxBotName: true,
    },
  });

  if (!company?.maxBotToken) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  if (company.maxWebhookSecret) {
    const header = request.headers.get("x-max-bot-api-secret");
    if (header !== company.maxWebhookSecret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const token = company.maxBotToken;
  const payload = (await request.json().catch(() => null)) as unknown;
  const updates = collectUpdates(payload);

  for (const update of updates) {
    await handleUpdate(company, token, update);
  }

  return NextResponse.json({ ok: true });
}

async function handleUpdate(
  company: { id: string; maxBotName: string | null },
  token: string,
  update: MaxUpdate,
) {
  const userId = updateUserId(update);
  if (!userId) return;

  const send = (body: string) => sendMaxMessageWithToken(token, userId, body);
  const type = update.update_type ?? "";
  const text = updateText(update);
  const startPayload =
    type === "bot_started" ? (update.payload ?? "").trim() : parseStartCommand(text).payload;
  const isStart = type === "bot_started" || parseStartCommand(text).isStart;

  if (isStart) {
    if (startPayload.startsWith("link_")) {
      const result = await linkClientByInviteToken({
        companyId: company.id,
        linkToken: startPayload.slice("link_".length),
        messenger: "max",
        messengerUserId: userId,
      });
      if (!result.ok) {
        await send(
          result.reason === "expired"
            ? "Срок действия ссылки истёк. Попросите менеджера прислать новую."
            : result.reason === "empty"
              ? "Ссылка приглашения неполная. Попросите менеджера прислать новую."
              : "Ссылка приглашения недействительна. Попросите менеджера прислать новую.",
        );
        return;
      }
      await send(
        result.already
          ? `Аккаунт ${result.name} уже привязан к этому MAX.\nУведомления по вашей сделке включены.`
          : `Аккаунт ${result.name} привязан.\nУведомления по вашей сделке включены.`,
      );
      return;
    }
    await send(formatMaxWelcomeMessage(userId, company.maxBotName));
    return;
  }

  if (!text) return;

  if (text === "/help" || text.startsWith("/help@")) {
    await send(
      [
        company.maxBotName || "Auto-CRM MAX",
        "",
        "/start — получить ID",
        "/link ваш@email.com — привязать MAX к аккаунту CRM",
        "/help — справка",
        "",
        "Клиенту удобнее открыть ссылку-приглашение от менеджера.",
      ].join("\n"),
    );
    return;
  }

  if (text === "/link" || text.startsWith("/link ") || text.startsWith("/link@")) {
    const email = text
      .replace(/^\/link(?:@[A-Za-z0-9_]+)?/i, "")
      .trim()
      .toLowerCase();

    if (!email) {
      await send("Отправьте: /link ваш@email.com\n\nEmail должен совпадать с аккаунтом в CRM.");
      return;
    }

    const user = await prisma.user.findUnique({
      where: { companyId_email: { companyId: company.id, email } },
    });

    if (!user) {
      await send("Пользователь с таким email не найден в вашей компании.");
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { maxUserId: userId },
    });

    await send(`Аккаунт ${user.name} привязан.\nУведомления CRM в MAX включены.`);
  }
}
