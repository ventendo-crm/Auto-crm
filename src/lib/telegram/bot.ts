const STAGE_LABELS: Record<string, string> = {
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

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const token = getBotToken();
  if (!token) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN is not set");
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = (await response.json()) as { ok: boolean; description?: string };

    if (!data.ok) {
      console.error("[telegram] send failed:", data.description);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[telegram] send error:", error);
    return false;
  }
}

export function formatStageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
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
    "После привязки вы будете получать уведомления о сделках.",
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
): Promise<void> {
  const unique = [...new Set(chatIds.filter((id): id is string => Boolean(id?.trim())))];

  await Promise.all(unique.map((chatId) => sendTelegramMessage(chatId, text)));
}

export function getDefaultTelegramChatIds(): string[] {
  const raw = process.env.TELEGRAM_CHAT_ID ?? process.env.TELEGRAM_NOTIFY_CHAT_IDS ?? "";
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}
