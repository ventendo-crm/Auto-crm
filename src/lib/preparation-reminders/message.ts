import { DealStageType } from "@prisma/client";

export const STAGE_REMINDER_STAGES = [
  DealStageType.PREPARATION,
  DealStageType.CUSTOMS,
  DealStageType.TRANSPORT,
] as const;

/** Часовой пояс CRM, тот же, что у Google Календаря. */
export const STAGE_REMINDER_TIMEZONE = "Europe/Moscow";

export const STAGE_REMINDER_MIN_DAYS = 1;
export const STAGE_REMINDER_MAX_DAYS = 365;
export const STAGE_REMINDER_INTERVAL_PRESETS = [1, 2, 3, 5, 7] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isStageReminderStage(stage: string): stage is (typeof STAGE_REMINDER_STAGES)[number] {
  return (STAGE_REMINDER_STAGES as readonly string[]).includes(stage);
}

export function addReminderDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}

export function isStageReminderDue(nextAt: Date | null, now: Date): boolean {
  return nextAt != null && nextAt.getTime() <= now.getTime();
}

/**
 * Следующая отправка.
 * Выключено или этап вне Подготовки, Таможни и Транспортировки — напоминание не планируется.
 * Включение и смена периодичности отсчитывают новый срок от текущего момента.
 */
export function computeStageReminderNextAt(input: {
  enabled: boolean;
  intervalDays: number;
  stage: string;
  now: Date;
  previous?: {
    enabled: boolean;
    intervalDays: number;
    nextAt: Date | null;
  };
}): Date | null {
  if (!input.enabled || !isStageReminderStage(input.stage)) {
    return null;
  }

  const previous = input.previous;
  const turnedOn = !previous?.enabled;
  const intervalChanged = !previous || previous.intervalDays !== input.intervalDays;
  if (!previous || turnedOn || intervalChanged || !previous.nextAt) {
    return addReminderDays(input.now, input.intervalDays);
  }

  return previous.nextAt;
}

export function formatReminderMoment(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: STAGE_REMINDER_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function carReminderLabel(carBrand?: string | null, carModel?: string | null): string {
  const label = [carBrand?.trim(), carModel?.trim()].filter(Boolean).join(" ");
  return label || "не указан";
}

export function renderStageReminderMessage(input: {
  clientName: string;
  carBrand?: string | null;
  carModel?: string | null;
  stageLabel: string;
  vin?: string | null;
  dealUrl: string;
}): { plain: string; html: string } {
  const clientName = input.clientName.trim() || "не указан";
  const carLabel = carReminderLabel(input.carBrand, input.carModel);
  const stageLabel = input.stageLabel.trim() || "не указан";
  const vin = input.vin?.trim() || "";
  const dealUrl = input.dealUrl.trim();

  const plainLines = [
    `Напоминание по клиенту: ${clientName}.`,
    "",
    `Автомобиль: ${carLabel}.`,
    "",
    `Текущий этап: ${stageLabel}.`,
    "",
    "Сделка находится на этом этапе. Проверьте актуальный статус оформления и при необходимости обновите информацию в CRM.",
  ];
  if (vin) {
    plainLines.push("", `VIN: ${vin}.`);
  }
  plainLines.push("", `Открыть карточку: ${dealUrl}`);

  const htmlLines = [
    `Напоминание по клиенту: <b>${escapeHtml(clientName)}</b>.`,
    "",
    `Автомобиль: <b>${escapeHtml(carLabel)}</b>.`,
    "",
    `Текущий этап: <b>${escapeHtml(stageLabel)}</b>.`,
    "",
    "Сделка находится на этом этапе. Проверьте актуальный статус оформления и при необходимости обновите информацию в CRM.",
  ];
  if (vin) {
    htmlLines.push("", `VIN: <code>${escapeHtml(vin)}</code>.`);
  }
  htmlLines.push("", `<a href="${escapeHtml(dealUrl)}">Открыть карточку клиента</a>`);

  return {
    plain: plainLines.join("\n"),
    html: htmlLines.join("\n"),
  };
}
