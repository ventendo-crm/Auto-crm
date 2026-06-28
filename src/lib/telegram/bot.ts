const STAGE_LABELS: Record<string, string> = {
  LEADS: "Лиды",
  SEARCH: "Поиск авто",
  INVOICE: "Инвойс",
  PREPARATION: "Подготовка",
  CUSTOMS: "Таможня",
  TRANSPORT: "Транспортировка",
  DELIVERY: "Получение",
};

const TELEGRAM_TIMEOUT_MS = 15_000;

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

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(parseMode ? { parse_mode: parseMode } : {}),
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = (await response.json()) as { ok: boolean; description?: string };

    if (!data.ok) {
      return { ok: false, chatId, error: data.description ?? "Unknown Telegram API error" };
    }

    return { ok: true, chatId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, chatId, error: message };
  }
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

export function formatStageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

export function formatCommentMessage(params: {
  clientName: string;
  vin: string;
  authorName: string;
  authorRole: string;
  text: string;
}): string {
  const preview =
    params.text.length > 200 ? `${params.text.slice(0, 200).trim()}…` : params.text;

  return [
    "💬 <b>Новый комментарий</b>",
    "",
    `<b>Клиент:</b> ${escapeHtml(params.clientName)}`,
    `<b>VIN:</b> ${escapeHtml(params.vin)}`,
    `<b>Автор:</b> ${escapeHtml(params.authorName)} (${escapeHtml(params.authorRole)})`,
    "",
    escapeHtml(preview),
  ].join("\n");
}

export function formatStageChangeMessage(params: {
  clientName: string;
  vin: string;
  fromStage: string;
  toStage: string;
  managerName: string;
  changedByName: string;
  date?: Date;
}): string {
  const date = params.date ?? new Date();
  const formattedDate = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return [
    "🚗 <b>Сделка переведена</b>",
    "",
    `<b>Клиент:</b> ${escapeHtml(params.clientName)}`,
    `<b>VIN:</b> ${escapeHtml(params.vin)}`,
    "",
    "<b>Этап:</b>",
    `${escapeHtml(formatStageLabel(params.fromStage))} → ${escapeHtml(formatStageLabel(params.toStage))}`,
    "",
    `<b>Менеджер:</b> ${escapeHtml(params.managerName)}`,
    `<b>Изменил:</b> ${escapeHtml(params.changedByName)}`,
    "",
    `<b>Дата:</b> ${formattedDate}`,
  ].join("\n");
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

export function formatTestNotificationMessage(userName: string): string {
  return [
    "✅ <b>Auto-CRM — тестовое уведомление</b>",
    "",
    `Аккаунт: ${escapeHtml(userName)}`,
    "Если вы видите это сообщение, Telegram настроен правильно.",
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendToTelegramChatIds(
  chatIds: Array<string | null | undefined>,
  text: string,
): Promise<TelegramSendResult[]> {
  const unique = [...new Set(chatIds.filter((id): id is string => Boolean(id?.trim())))];

  return Promise.all(unique.map((chatId) => postTelegramMessage(chatId, text, "HTML").then(async (result) => {
    if (result.ok) return result;
    if (result.error?.includes("can't parse entities")) {
      return postTelegramMessage(chatId, text.replace(/<[^>]+>/g, ""));
    }
    return result;
  })));
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
  const text = formatTestNotificationMessage(params.userName);
  const result = await postTelegramMessage(params.chatId, text, "HTML");
  if (result.ok) return result;
  return postTelegramMessage(params.chatId, text.replace(/<[^>]+>/g, ""));
}
