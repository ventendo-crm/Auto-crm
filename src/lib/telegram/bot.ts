import { callTelegramApi } from "@/lib/telegram/http";
import { formatTestNotificationMessage } from "@/lib/telegram/templates";

export {
  formatCommentMessage,
  formatClientStageNotificationMessage,
  formatStageChangeMessage,
  formatStageLabel,
  formatTestNotificationMessage,
} from "@/lib/telegram/templates";

function getBotToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return token || null;
}

export function isTelegramConfigured(): boolean {
  return Boolean(getBotToken());
}

export interface TelegramSendResult {
  ok: boolean;
  chatId: string;
  error?: string;
}

async function postTelegramMessage(
  chatId: string,
  text: string,
  parseMode?: "HTML",
): Promise<TelegramSendResult> {
  const token = getBotToken();
  if (!token) {
    return { ok: false, chatId, error: "TELEGRAM_BOT_TOKEN is not set" };
  }

  const result = await callTelegramApi(token, "sendMessage", {
    chat_id: chatId,
    text,
    ...(parseMode ? { parse_mode: parseMode } : {}),
    disable_web_page_preview: true,
  });

  if (!result.ok) {
    return { ok: false, chatId, error: result.error };
  }

  return { ok: true, chatId };
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const htmlResult = await postTelegramMessage(chatId, text, "HTML");

  if (htmlResult.ok) {
    return true;
  }

  if (htmlResult.error?.includes("can't parse entities")) {
    const plainResult = await postTelegramMessage(chatId, text.replace(/<[^>]+>/g, ""));
    if (!plainResult.ok) {
      console.error("[telegram] send failed (plain):", plainResult.error, "chatId=", chatId);
    }
    return plainResult.ok;
  }

  console.error("[telegram] send failed:", htmlResult.error, "chatId=", chatId);
  return false;
}

export function formatWelcomeMessage(chatId: number | string): string {
  return [
    "👋 <b>Auto-CRM Bot</b>",
    "",
    `Ваш Chat ID: <code>${chatId}</code>`,
    "",
    "Скопируйте ID и добавьте в CRM:",
    "Настройки → Telegram → Привязать",
    "",
    "Или отправьте: <code>/link ваш@email.com</code>",
    "",
    "После привязки вы будете получать уведомления о сделках.",
  ].join("\n");
}

export async function sendToTelegramChatIds(
  chatIds: Array<string | null | undefined>,
  text: string,
): Promise<TelegramSendResult[]> {
  const unique = [...new Set(chatIds.filter((id): id is string => Boolean(id?.trim())))];

  return Promise.all(
    unique.map((chatId) =>
      postTelegramMessage(chatId, text, "HTML").then(async (result) => {
        if (result.ok) return result;
        if (result.error?.includes("can't parse entities")) {
          return postTelegramMessage(chatId, text.replace(/<[^>]+>/g, ""));
        }
        return result;
      }),
    ),
  );
}

export function getDefaultTelegramChatIds(): string[] {
  const raw = process.env.TELEGRAM_CHAT_ID ?? process.env.TELEGRAM_NOTIFY_CHAT_IDS ?? "";
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export async function sendTestTelegramNotification(params: {
  chatId: string;
  userName: string;
}): Promise<TelegramSendResult> {
  const text = await formatTestNotificationMessage(params.userName);
  const result = await postTelegramMessage(params.chatId, text, "HTML");
  if (result.ok) return result;
  return postTelegramMessage(params.chatId, text.replace(/<[^>]+>/g, ""));
}
