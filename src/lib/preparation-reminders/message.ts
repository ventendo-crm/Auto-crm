import { DealStageType } from "@prisma/client";
import { renderTemplateString } from "@/lib/email/render";

export const STAGE_REMINDER_STAGES = [
  DealStageType.PREPARATION,
  DealStageType.CUSTOMS,
  DealStageType.TRANSPORT,
] as const;

export function isStageReminderStage(stage: string): stage is (typeof STAGE_REMINDER_STAGES)[number] {
  return (STAGE_REMINDER_STAGES as readonly string[]).includes(stage);
}

export const PREPARATION_REMINDER_MIN_HOURS = 1;
export const PREPARATION_REMINDER_MAX_HOURS = 168;
export const PREPARATION_REMINDER_TEMPLATE_MAX = 2000;

export const PREPARATION_REMINDER_INTERVAL_PRESETS = [1, 6, 12, 24, 48, 72] as const;

export const DEFAULT_PREPARATION_REMINDER_TEMPLATE = `Напоминание: нужно написать клиенту статус его авто.

Клиент: {{clientName}}
Авто: {{carLabel}}
VIN: {{vin}}
Этап: {{stageLabel}}
На этапе с {{onStageSince}}.`;

export const PREPARATION_REMINDER_PLACEHOLDERS = [
  "clientName",
  "vin",
  "carBrand",
  "carModel",
  "carLabel",
  "stageLabel",
  "onStageSince",
] as const;

const TELEGRAM_TEXT_LIMIT = 4000;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function isPreparationReminderDue(
  lastSentAt: Date | null,
  intervalHours: number,
  now: Date,
): boolean {
  if (!lastSentAt) return true;
  const elapsedMs = now.getTime() - lastSentAt.getTime();
  return elapsedMs >= intervalHours * 60 * 60 * 1000;
}

export function formatReminderMoment(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function preparationReminderVars(input: {
  clientName: string;
  vin: string;
  carBrand?: string | null;
  carModel?: string | null;
  stageLabel: string;
  stageEnteredAt: Date;
}): Record<string, string> {
  const carBrand = input.carBrand?.trim() || "";
  const carModel = input.carModel?.trim() || "";
  const carLabel = [carBrand, carModel].filter(Boolean).join(" ") || "не указано";

  return {
    clientName: input.clientName.trim() || "не указан",
    vin: input.vin.trim() || "не указан",
    carBrand: carBrand || "не указана",
    carModel: carModel || "не указана",
    carLabel,
    stageLabel: input.stageLabel.trim() || "не указан",
    onStageSince: formatReminderMoment(input.stageEnteredAt),
  };
}

export function renderPreparationReminder(
  template: string,
  vars: Record<string, string>,
): { plain: string; html: string } {
  const plain = renderTemplateString(template, vars).trim();
  const html = renderTemplateString(
    escapeHtml(template),
    Object.fromEntries(Object.entries(vars).map(([key, value]) => [key, escapeHtml(value)])),
  )
    .trim()
    .slice(0, TELEGRAM_TEXT_LIMIT);

  return { plain, html };
}
