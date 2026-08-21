import { GoogleCalendarSourceType } from "@prisma/client";
import { GOOGLE_CALENDAR_NAME, GOOGLE_CALENDAR_TIMEZONE } from "@/lib/google-calendar/config";

type CalendarEventPayload = {
  summary: string;
  description: string;
  date: string;
  sourceType: GoogleCalendarSourceType;
  sourceId: string;
  companyId: string;
};

function calendarPath(calendarId: string, suffix = ""): string {
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}${suffix}`;
}

async function googleJson<T>(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const text = await response.text();
  let data = {} as T & { error?: { message?: string; code?: number } };
  if (text) {
    try {
      data = JSON.parse(text) as T & { error?: { message?: string; code?: number } };
    } catch {
      data = {} as T & { error?: { message?: string; code?: number } };
    }
  }

  if (!response.ok) {
    const message = data.error?.message || `Ошибка Google Calendar (${response.status})`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return data as T;
}

export async function listGoogleCalendars(
  accessToken: string,
): Promise<Array<{ id: string; summary: string }>> {
  const data = await googleJson<{ items?: Array<{ id?: string; summary?: string }> }>(
    accessToken,
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250",
  );

  return (data.items ?? [])
    .filter((item): item is { id: string; summary: string } => Boolean(item.id && item.summary))
    .map((item) => ({ id: item.id, summary: item.summary }));
}

export async function createImportCrmCalendar(accessToken: string): Promise<string> {
  const created = await googleJson<{ id?: string }>(
    accessToken,
    "https://www.googleapis.com/calendar/v3/calendars",
    {
      method: "POST",
      body: JSON.stringify({
        summary: GOOGLE_CALENDAR_NAME,
        timeZone: GOOGLE_CALENDAR_TIMEZONE,
      }),
    },
  );

  if (!created.id) {
    throw new Error("Google не вернул идентификатор календаря");
  }

  return created.id;
}

export async function ensureImportCrmCalendar(
  accessToken: string,
  existingCalendarId?: string | null,
): Promise<string> {
  if (existingCalendarId) {
    try {
      await googleJson(accessToken, calendarPath(existingCalendarId));
      return existingCalendarId;
    } catch (error) {
      if ((error as { status?: number }).status !== 404) {
        throw error;
      }
    }
  }

  const calendars = await listGoogleCalendars(accessToken);
  const found = calendars.find((item) => item.summary === GOOGLE_CALENDAR_NAME);
  if (found) return found.id;

  return createImportCrmCalendar(accessToken);
}

function isAllDayDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * All-day events must use `date` (YYYY-MM-DD) and clear `dateTime`.
 * Otherwise Google may keep a previous timed start and return "Invalid start time"
 * on update (PATCH/PUT merge of date + dateTime).
 */
function toEventBody(payload: CalendarEventPayload) {
  if (!isAllDayDateKey(payload.date)) {
    throw new Error(`Некорректная дата события для Google Calendar: ${payload.date}`);
  }

  const nextDay = addOneDay(payload.date);
  if (!isAllDayDateKey(nextDay)) {
    throw new Error(`Некорректная конечная дата события для Google Calendar: ${nextDay}`);
  }

  return {
    summary: payload.summary,
    description: payload.description,
    start: { date: payload.date, dateTime: null },
    end: { date: nextDay, dateTime: null },
    colorId: payload.sourceType === "CUSTOMS" ? "9" : "6",
    extendedProperties: {
      private: {
        companyId: payload.companyId,
        sourceType: payload.sourceType,
        sourceId: payload.sourceId,
      },
    },
  };
}

function addOneDay(date: string): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(value.getTime())) {
    throw new Error(`Некорректная дата события для Google Calendar: ${date}`);
  }
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function isInvalidStartTimeError(error: unknown): boolean {
  return error instanceof Error && /invalid start time/i.test(error.message);
}

export async function upsertGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  googleEventId: string | null,
  payload: CalendarEventPayload,
): Promise<string> {
  const body = toEventBody(payload);
  const eventUrl = googleEventId
    ? calendarPath(calendarId, `/events/${encodeURIComponent(googleEventId)}`)
    : null;

  if (googleEventId && eventUrl) {
    try {
      // PUT replaces start/end cleanly; PATCH can leave both date and dateTime set.
      const updated = await googleJson<{ id?: string }>(accessToken, eventUrl, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      if (updated.id) return updated.id;
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 404 || status === 410 || isInvalidStartTimeError(error)) {
        if (status !== 404 && status !== 410) {
          await deleteGoogleCalendarEvent(accessToken, calendarId, googleEventId);
        }
      } else {
        throw error;
      }
    }
  }

  const created = await googleJson<{ id?: string }>(
    accessToken,
    calendarPath(calendarId, "/events"),
    { method: "POST", body: JSON.stringify(body) },
  );

  if (!created.id) {
    throw new Error("Google не вернул идентификатор события");
  }

  return created.id;
}

export async function deleteGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  googleEventId: string,
): Promise<void> {
  try {
    await googleJson(
      accessToken,
      calendarPath(calendarId, `/events/${encodeURIComponent(googleEventId)}`),
      { method: "DELETE" },
    );
  } catch (error) {
    if ((error as { status?: number }).status === 404 || (error as { status?: number }).status === 410) {
      return;
    }
    throw error;
  }
}
