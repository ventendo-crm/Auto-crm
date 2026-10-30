import { DealStageType } from "@prisma/client";

export const STAGE_REMINDER_STAGES = [
  DealStageType.PREPARATION,
  DealStageType.CUSTOMS,
  DealStageType.TRANSPORT,
] as const;

export const STAGE_REMINDER_TIMEZONES = [
  { id: "Europe/Kaliningrad", label: "Калининград (UTC+2)" },
  { id: "Europe/Moscow", label: "Москва (UTC+3)" },
  { id: "Europe/Samara", label: "Самара (UTC+4)" },
  { id: "Asia/Yekaterinburg", label: "Екатеринбург (UTC+5)" },
  { id: "Asia/Omsk", label: "Омск (UTC+6)" },
  { id: "Asia/Krasnoyarsk", label: "Красноярск (UTC+7)" },
  { id: "Asia/Irkutsk", label: "Иркутск (UTC+8)" },
  { id: "Asia/Yakutsk", label: "Якутск (UTC+9)" },
  { id: "Asia/Vladivostok", label: "Владивосток (UTC+10)" },
  { id: "Asia/Magadan", label: "Магадан (UTC+11)" },
  { id: "Asia/Kamchatka", label: "Камчатка (UTC+12)" },
] as const;

export type StageReminderTimeZone = (typeof STAGE_REMINDER_TIMEZONES)[number]["id"];

export const DEFAULT_STAGE_REMINDER_TIME = "10:00";
export const DEFAULT_STAGE_REMINDER_TIMEZONE: StageReminderTimeZone = "Europe/Moscow";

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

export function isStageReminderTimeZone(value: string): value is StageReminderTimeZone {
  return STAGE_REMINDER_TIMEZONES.some((zone) => zone.id === value);
}

export function stageReminderTimeZoneLabel(timeZone: string): string {
  const known = STAGE_REMINDER_TIMEZONES.find((zone) => zone.id === timeZone);
  if (!known) return timeZone;
  return known.label.replace(/\s*\(UTC\+\d+\)$/, "");
}

export function parseStageReminderSendTime(value: string): { hour: number; minute: number } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

type CivilDate = { year: number; month: number; day: number };

function zonedParts(date: Date, timeZone: string): CivilDate & { hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: hour === 24 ? 0 : hour,
    minute: Number(parts.minute),
  };
}

function addCalendarDays(date: CivilDate, days: number): CivilDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function zonedTimeToUtc(
  date: CivilDate,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(date.year, date.month - 1, date.day, hour, minute, 0);
  const seen = zonedParts(new Date(guess), timeZone);
  const seenUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, 0);
  return new Date(guess - (seenUtc - guess));
}

function resolveSchedule(sendTime: string, timeZone: string): {
  hour: number;
  minute: number;
  timeZone: string;
} {
  const parsed = parseStageReminderSendTime(sendTime) ?? parseStageReminderSendTime(DEFAULT_STAGE_REMINDER_TIME)!;
  return {
    hour: parsed.hour,
    minute: parsed.minute,
    timeZone: isStageReminderTimeZone(timeZone) ? timeZone : DEFAULT_STAGE_REMINDER_TIMEZONE,
  };
}

/**
 * Ближайшая отправка в выбранное местное время.
 * «Каждый день» — сегодня, если это время ещё впереди, иначе завтра.
 * Интервал в несколько дней — через столько календарных дней в этом часовом поясе.
 */
export function scheduleStageReminderAt(input: {
  now: Date;
  intervalDays: number;
  sendTime: string;
  timeZone: string;
}): Date {
  const { hour, minute, timeZone } = resolveSchedule(input.sendTime, input.timeZone);
  const today = zonedParts(input.now, timeZone);
  let cursor = addCalendarDays(today, input.intervalDays > 1 ? input.intervalDays : 0);

  for (let step = 0; step < 400; step += 1) {
    const candidate = zonedTimeToUtc(cursor, hour, minute, timeZone);
    if (candidate.getTime() > input.now.getTime()) return candidate;
    cursor = addCalendarDays(cursor, input.intervalDays);
  }

  return addReminderDays(input.now, input.intervalDays);
}

/** Следующий слот после уже запланированной отправки, в том же местном времени. */
export function advanceStageReminderSchedule(input: {
  scheduledAt: Date;
  now: Date;
  intervalDays: number;
  sendTime: string;
  timeZone: string;
}): Date {
  const { hour, minute, timeZone } = resolveSchedule(input.sendTime, input.timeZone);
  const scheduled = zonedParts(input.scheduledAt, timeZone);
  let cursor = addCalendarDays(scheduled, input.intervalDays);

  for (let step = 0; step < 400; step += 1) {
    const candidate = zonedTimeToUtc(cursor, hour, minute, timeZone);
    if (candidate.getTime() > input.now.getTime()) return candidate;
    cursor = addCalendarDays(cursor, input.intervalDays);
  }

  return scheduleStageReminderAt(input);
}

function scheduledClockMatches(nextAt: Date, sendTime: string, timeZone: string): boolean {
  const { hour, minute, timeZone: zone } = resolveSchedule(sendTime, timeZone);
  const parts = zonedParts(nextAt, zone);
  return parts.hour === hour && parts.minute === minute;
}

/**
 * Следующая отправка.
 * Выключено или этап вне Подготовки, Таможни и Транспортировки — напоминание не планируется.
 * Включение, смена периодичности, времени или часового пояса ставят новый срок.
 */
export function computeStageReminderNextAt(input: {
  enabled: boolean;
  intervalDays: number;
  sendTime: string;
  timeZone: string;
  stage: string;
  now: Date;
  previous?: {
    enabled: boolean;
    intervalDays: number;
    sendTime: string;
    timeZone: string;
    nextAt: Date | null;
  };
}): Date | null {
  if (!input.enabled || !isStageReminderStage(input.stage)) {
    return null;
  }

  const previous = input.previous;
  const turnedOn = !previous?.enabled;
  const intervalChanged = !previous || previous.intervalDays !== input.intervalDays;
  const timeChanged = !previous || previous.sendTime !== input.sendTime;
  const zoneChanged = !previous || previous.timeZone !== input.timeZone;
  const clockMismatch =
    previous?.nextAt != null &&
    !scheduledClockMatches(previous.nextAt, input.sendTime, input.timeZone);

  if (!previous || turnedOn || intervalChanged || timeChanged || zoneChanged || clockMismatch || !previous.nextAt) {
    return scheduleStageReminderAt(input);
  }

  return previous.nextAt;
}

export function formatReminderMoment(date: Date, timeZone: string = DEFAULT_STAGE_REMINDER_TIMEZONE): string {
  const zone = isStageReminderTimeZone(timeZone) ? timeZone : DEFAULT_STAGE_REMINDER_TIMEZONE;
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: zone,
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

/**
 * Момент отправки задачи: календарный день срока (UTC-дата dueDate) + время/пояс сделки.
 */
export function computeTaskReminderNotifyAt(
  dueDate: Date,
  sendTime: string,
  timeZone: string,
): Date {
  const { hour, minute, timeZone: zone } = resolveSchedule(sendTime, timeZone);
  return zonedTimeToUtc(
    {
      year: dueDate.getUTCFullYear(),
      month: dueDate.getUTCMonth() + 1,
      day: dueDate.getUTCDate(),
    },
    hour,
    minute,
    zone,
  );
}

export function formatTaskDueDate(dueDate: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dueDate);
}

export function renderTaskReminderMessage(input: {
  clientName: string;
  title: string;
  dueDateLabel: string;
  carBrand?: string | null;
  carModel?: string | null;
  vin?: string | null;
  dealUrl: string;
}): { plain: string; html: string } {
  const clientName = input.clientName.trim() || "не указан";
  const title = input.title.trim() || "без названия";
  const dueDateLabel = input.dueDateLabel.trim() || "не указан";
  const carLabel = carReminderLabel(input.carBrand, input.carModel);
  const vin = input.vin?.trim() || "";
  const dealUrl = input.dealUrl.trim();

  const plainLines = [
    `Задача по клиенту: ${clientName}.`,
    "",
    `Что сделать: ${title}.`,
    "",
    `Срок: ${dueDateLabel}.`,
    "",
    `Автомобиль: ${carLabel}.`,
  ];
  if (vin) {
    plainLines.push("", `VIN: ${vin}.`);
  }
  plainLines.push("", `Открыть карточку: ${dealUrl}`);

  const htmlLines = [
    `Задача по клиенту: <b>${escapeHtml(clientName)}</b>.`,
    "",
    `Что сделать: <b>${escapeHtml(title)}</b>.`,
    "",
    `Срок: <b>${escapeHtml(dueDateLabel)}</b>.`,
    "",
    `Автомобиль: <b>${escapeHtml(carLabel)}</b>.`,
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
