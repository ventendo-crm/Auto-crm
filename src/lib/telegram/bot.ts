import { callTelegramApi } from "@/lib/telegram/http";

const STAGE_LABELS: Record<string, string> = {
  LEADS: "Лиды",
  SEARCH: "Поиск авто",
  INVOICE: "Инвойс",
  PREPARATION: "Подготовка",
  CUSTOMS: "Таможня",
  TRANSPORT: "Транспортировка",
  DELIVERY: "Получение",
};

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

export function formatClientStageNotificationMessage(params: {
  stageLabel: string;
  body: string;
  carLabel?: string | null;
  vin?: string | null;
}): string {
  const lines = [
    "📣 <b>Обновление по вашей сделке</b>",
    "",
    `<b>Этап:</b> ${escapeHtml(params.stageLabel)}`,
    "",
    escapeHtml(params.body),
  ];

  if (params.carLabel?.trim()) {
    lines.push("", `<b>Автомобиль:</b> ${escapeHtml(params.carLabel.trim())}`);
  }

  if (params.vin?.trim()) {
    lines.push(`<b>VIN:</b> ${escapeHtml(params.vin.trim())}`);
  }

  lines.push("", "Подробности — в личном кабинете Auto-CRM.");

  return lines.join("\n");
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
