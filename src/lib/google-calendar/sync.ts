import { GoogleCalendarSourceType } from "@prisma/client";
import {
  deleteGoogleCalendarEvent,
  ensureImportCrmCalendar,
  upsertGoogleCalendarEvent,
} from "@/lib/google-calendar/api";
import { GOOGLE_CALENDAR_TIMEZONE } from "@/lib/google-calendar/config";
import { decryptSecret, encryptSecret } from "@/lib/google-calendar/crypto";
import { refreshGoogleAccessToken } from "@/lib/google-calendar/oauth";
import { prisma } from "@/lib/prisma";
import { getAppPublicUrl } from "@/lib/telegram/bot";

type DealEventFields = {
  id: string;
  companyId: string;
  clientName: string;
  vin: string;
  carBrand: string | null;
  carModel: string | null;
};

function formatCarLabel(deal: Pick<DealEventFields, "carBrand" | "carModel" | "vin">): string {
  const label = [deal.carBrand, deal.carModel].filter(Boolean).join(" ").trim();
  return label || deal.vin;
}

/** Calendar day in ImportCRM timezone (all-day Google events). */
function toDateKey(value: Date): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error("Некорректная дата для Google Calendar");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: GOOGLE_CALENDAR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Не удалось сформировать дату для Google Calendar");
  }

  return `${year}-${month}-${day}`;
}

function dealUrl(dealId: string): string {
  return `${getAppPublicUrl()}/deals/${dealId}`;
}

export function scheduleGoogleCalendarJob(task: () => Promise<void>): void {
  void task().catch((error) => {
    console.error("[google-calendar]", error);
  });
}

async function getAccessToken(companyId: string): Promise<{
  accessToken: string;
  calendarId: string;
} | null> {
  const settings = await prisma.companyGoogleCalendarSettings.findUnique({
    where: { companyId },
  });
  if (!settings) return null;

  const refreshToken = decryptSecret(settings.refreshTokenEnc);
  let accessToken = settings.accessTokenEnc ? decryptSecret(settings.accessTokenEnc) : null;
  let expiresAt = settings.accessTokenExpiresAt;

  if (!accessToken || !expiresAt || expiresAt.getTime() <= Date.now()) {
    try {
      const refreshed = await refreshGoogleAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
      expiresAt = refreshed.expiresAt;
      await prisma.companyGoogleCalendarSettings.update({
        where: { companyId },
        data: {
          accessTokenEnc: encryptSecret(accessToken),
          accessTokenExpiresAt: expiresAt,
          refreshTokenEnc: refreshed.refreshToken
            ? encryptSecret(refreshed.refreshToken)
            : undefined,
          lastSyncError: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось обновить токен Google";
      await prisma.companyGoogleCalendarSettings.update({
        where: { companyId },
        data: { lastSyncError: message },
      });
      throw error;
    }
  }

  return { accessToken, calendarId: settings.calendarId };
}

async function rememberSyncError(companyId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : "Ошибка синхронизации Google Calendar";
  await prisma.companyGoogleCalendarSettings.updateMany({
    where: { companyId },
    data: { lastSyncError: message.slice(0, 500) },
  });
}

async function touchSyncSuccess(companyId: string): Promise<void> {
  await prisma.companyGoogleCalendarSettings.update({
    where: { companyId },
    data: { lastSyncAt: new Date(), lastSyncError: null },
  });
}

async function upsertMappedEvent(params: {
  companyId: string;
  dealId: string;
  sourceType: GoogleCalendarSourceType;
  sourceId: string;
  summary: string;
  description: string;
  date: Date;
}): Promise<void> {
  const tokens = await getAccessToken(params.companyId);
  if (!tokens) return;

  const existing = await prisma.googleCalendarEventMap.findUnique({
    where: {
      companyId_sourceType_sourceId: {
        companyId: params.companyId,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
      },
    },
  });

  const googleEventId = await upsertGoogleCalendarEvent(
    tokens.accessToken,
    tokens.calendarId,
    existing?.googleEventId ?? null,
    {
      summary: params.summary,
      description: params.description,
      date: toDateKey(params.date),
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      companyId: params.companyId,
    },
  );

  await prisma.googleCalendarEventMap.upsert({
    where: {
      companyId_sourceType_sourceId: {
        companyId: params.companyId,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
      },
    },
    create: {
      companyId: params.companyId,
      dealId: params.dealId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      googleEventId,
    },
    update: {
      dealId: params.dealId,
      googleEventId,
    },
  });

  await touchSyncSuccess(params.companyId);
}

async function removeMappedEvent(params: {
  companyId: string;
  sourceType: GoogleCalendarSourceType;
  sourceId: string;
}): Promise<void> {
  const existing = await prisma.googleCalendarEventMap.findUnique({
    where: {
      companyId_sourceType_sourceId: {
        companyId: params.companyId,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
      },
    },
  });
  if (!existing) return;

  const tokens = await getAccessToken(params.companyId);
  if (tokens) {
    await deleteGoogleCalendarEvent(tokens.accessToken, tokens.calendarId, existing.googleEventId);
  }

  await prisma.googleCalendarEventMap.delete({
    where: { id: existing.id },
  });
}

export async function syncCustomsDateToGoogle(dealId: string): Promise<void> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      companyId: true,
      clientName: true,
      vin: true,
      carBrand: true,
      carModel: true,
      shipment: { select: { customsCompleted: true } },
    },
  });
  if (!deal) return;

  const connected = await prisma.companyGoogleCalendarSettings.findUnique({
    where: { companyId: deal.companyId },
    select: { companyId: true },
  });
  if (!connected) return;

  const customsDate = deal.shipment?.customsCompleted;
  if (!customsDate) {
    await removeMappedEvent({
      companyId: deal.companyId,
      sourceType: "CUSTOMS",
      sourceId: deal.id,
    });
    return;
  }

  const carLabel = formatCarLabel(deal);
  await upsertMappedEvent({
    companyId: deal.companyId,
    dealId: deal.id,
    sourceType: "CUSTOMS",
    sourceId: deal.id,
    date: customsDate,
    summary: `Таможня: ${carLabel} · ${deal.clientName}`,
    description: [
      `Дата таможни по сделке`,
      `Клиент: ${deal.clientName}`,
      `Авто: ${carLabel}`,
      `VIN: ${deal.vin}`,
      dealUrl(deal.id),
    ].join("\n"),
  });
}

export async function syncReminderToGoogle(reminderId: string): Promise<void> {
  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
    include: {
      deal: {
        select: {
          id: true,
          companyId: true,
          clientName: true,
          vin: true,
          carBrand: true,
          carModel: true,
        },
      },
    },
  });
  if (!reminder) return;

  const connected = await prisma.companyGoogleCalendarSettings.findUnique({
    where: { companyId: reminder.deal.companyId },
    select: { companyId: true },
  });
  if (!connected) return;

  if (reminder.completed) {
    await removeMappedEvent({
      companyId: reminder.deal.companyId,
      sourceType: "REMINDER",
      sourceId: reminder.id,
    });
    return;
  }

  const carLabel = formatCarLabel(reminder.deal);
  await upsertMappedEvent({
    companyId: reminder.deal.companyId,
    dealId: reminder.deal.id,
    sourceType: "REMINDER",
    sourceId: reminder.id,
    date: reminder.dueDate,
    summary: `Напоминание: ${reminder.title} · ${reminder.deal.clientName}`,
    description: [
      reminder.title,
      `Клиент: ${reminder.deal.clientName}`,
      `Авто: ${carLabel}`,
      `VIN: ${reminder.deal.vin}`,
      dealUrl(reminder.deal.id),
    ].join("\n"),
  });
}

export async function removeReminderFromGoogle(companyId: string, reminderId: string): Promise<void> {
  const connected = await prisma.companyGoogleCalendarSettings.findUnique({
    where: { companyId },
    select: { companyId: true },
  });
  if (!connected) return;

  await removeMappedEvent({
    companyId,
    sourceType: "REMINDER",
    sourceId: reminderId,
  });
}

export async function removeDealEventsFromGoogle(companyId: string, dealId: string): Promise<void> {
  const maps = await prisma.googleCalendarEventMap.findMany({
    where: { companyId, dealId },
  });
  if (maps.length === 0) return;

  const tokens = await getAccessToken(companyId);
  if (tokens) {
    for (const item of maps) {
      await deleteGoogleCalendarEvent(tokens.accessToken, tokens.calendarId, item.googleEventId);
    }
  }

  await prisma.googleCalendarEventMap.deleteMany({
    where: { companyId, dealId },
  });
}

export async function syncDealGoogleCalendarEvents(dealId: string): Promise<void> {
  await syncCustomsDateToGoogle(dealId);

  const reminders = await prisma.reminder.findMany({
    where: { dealId, completed: false },
    select: { id: true },
  });
  for (const reminder of reminders) {
    await syncReminderToGoogle(reminder.id);
  }
}

export async function backfillCompanyGoogleCalendar(companyId: string): Promise<void> {
  const settings = await prisma.companyGoogleCalendarSettings.findUnique({
    where: { companyId },
  });
  if (!settings) return;

  const tokens = await getAccessToken(companyId);
  if (!tokens) return;

  const calendarId = await ensureImportCrmCalendar(tokens.accessToken, settings.calendarId);
  if (calendarId !== settings.calendarId) {
    await prisma.companyGoogleCalendarSettings.update({
      where: { companyId },
      data: { calendarId },
    });
  }

  const deals = await prisma.deal.findMany({
    where: { companyId },
    select: {
      id: true,
      shipment: { select: { customsCompleted: true } },
      reminders: {
        where: { completed: false },
        select: { id: true },
      },
    },
  });

  const errors: string[] = [];

  for (const deal of deals) {
    try {
      if (deal.shipment?.customsCompleted) {
        await syncCustomsDateToGoogle(deal.id);
      }
      for (const reminder of deal.reminders) {
        await syncReminderToGoogle(reminder.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка синхронизации Google Calendar";
      errors.push(message);
      console.error(`[google-calendar] deal ${deal.id}:`, error);
    }
  }

  if (errors.length > 0) {
    await rememberSyncError(companyId, new Error(errors[0]));
    throw new Error(
      errors.length === 1
        ? errors[0]
        : `${errors[0]} (ещё ошибок: ${errors.length - 1})`,
    );
  }

  await touchSyncSuccess(companyId);
}

export function scheduleCustomsSync(dealId: string): void {
  scheduleGoogleCalendarJob(async () => {
    try {
      await syncCustomsDateToGoogle(dealId);
    } catch (error) {
      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: { companyId: true },
      });
      if (deal) await rememberSyncError(deal.companyId, error);
      throw error;
    }
  });
}

export function scheduleReminderSync(reminderId: string): void {
  scheduleGoogleCalendarJob(async () => {
    try {
      await syncReminderToGoogle(reminderId);
    } catch (error) {
      const reminder = await prisma.reminder.findUnique({
        where: { id: reminderId },
        select: { deal: { select: { companyId: true } } },
      });
      if (reminder) await rememberSyncError(reminder.deal.companyId, error);
      throw error;
    }
  });
}

export function scheduleReminderRemoval(companyId: string, reminderId: string): void {
  scheduleGoogleCalendarJob(() => removeReminderFromGoogle(companyId, reminderId));
}

export function scheduleDealRemoval(companyId: string, dealId: string): void {
  scheduleGoogleCalendarJob(() => removeDealEventsFromGoogle(companyId, dealId));
}

export function scheduleDealRefresh(dealId: string): void {
  scheduleGoogleCalendarJob(() => syncDealGoogleCalendarEvents(dealId));
}

export function scheduleCompanyBackfill(companyId: string): void {
  scheduleGoogleCalendarJob(async () => {
    try {
      await backfillCompanyGoogleCalendar(companyId);
    } catch (error) {
      await rememberSyncError(companyId, error);
      throw error;
    }
  });
}
