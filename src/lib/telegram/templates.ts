import { renderTemplateString } from "@/lib/email/render";
import { getTelegramTemplateRecord } from "@/lib/telegram/template-store";

export const TELEGRAM_TEMPLATE_PLACEHOLDERS = {
  STAGE_CHANGE: [
    "clientName",
    "vin",
    "fromStage",
    "toStage",
    "managerName",
    "changedByName",
    "date",
  ],
  CLIENT_STAGE: ["stageLabel", "body", "carLine", "vinLine"],
  COMMENT: ["clientName", "vin", "authorName", "authorRole", "commentText"],
  TEST: ["userName"],
} as const;

export type TelegramTemplateKey = keyof typeof TELEGRAM_TEMPLATE_PLACEHOLDERS;

const STAGE_LABELS: Record<string, string> = {
  LEADS: "Лиды",
  SEARCH: "Поиск авто",
  INVOICE: "Инвойс",
  PREPARATION: "Подготовка",
  CUSTOMS: "Таможня",
  TRANSPORT: "Транспортировка",
  DELIVERY: "Получение",
};

export function formatStageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeVars(vars: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(vars).map(([key, value]) => [key, escapeHtml(value)]),
  );
}

async function renderTelegramTemplate(
  companyId: string,
  key: TelegramTemplateKey,
  vars: Record<string, string>,
): Promise<string> {
  const template = await getTelegramTemplateRecord(companyId, key);
  return renderTemplateString(template.textBody, escapeVars(vars)).trim();
}

export async function formatStageChangeMessage(params: {
  companyId: string;
  clientName: string;
  vin: string;
  fromStage: string;
  toStage: string;
  managerName: string;
  changedByName: string;
  date?: Date;
}): Promise<string> {
  const date = params.date ?? new Date();
  const formattedDate = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return renderTelegramTemplate(params.companyId, "STAGE_CHANGE", {
    clientName: params.clientName,
    vin: params.vin,
    fromStage: formatStageLabel(params.fromStage),
    toStage: formatStageLabel(params.toStage),
    managerName: params.managerName,
    changedByName: params.changedByName,
    date: formattedDate,
  });
}

export async function formatClientStageNotificationMessage(params: {
  companyId: string;
  stageLabel: string;
  body: string;
  carLabel?: string | null;
  vin?: string | null;
}): Promise<string> {
  const template = await getTelegramTemplateRecord(params.companyId, "CLIENT_STAGE");
  return renderTemplateString(template.textBody, {
    stageLabel: escapeHtml(params.stageLabel),
    body: escapeHtml(params.body),
    carLine: params.carLabel?.trim()
      ? `\n\n<b>Автомобиль:</b> ${escapeHtml(params.carLabel.trim())}`
      : "",
    vinLine: params.vin?.trim() ? `\n<b>VIN:</b> ${escapeHtml(params.vin.trim())}` : "",
  }).trim();
}

export async function formatCommentMessage(params: {
  companyId: string;
  clientName: string;
  vin: string;
  authorName: string;
  authorRole: string;
  text: string;
}): Promise<string> {
  const preview =
    params.text.length > 200 ? `${params.text.slice(0, 200).trim()}…` : params.text;

  return renderTelegramTemplate(params.companyId, "COMMENT", {
    clientName: params.clientName,
    vin: params.vin,
    authorName: params.authorName,
    authorRole: params.authorRole,
    commentText: preview,
  });
}

export async function formatTestNotificationMessage(
  companyId: string,
  userName: string,
): Promise<string> {
  return renderTelegramTemplate(companyId, "TEST", { userName });
}
