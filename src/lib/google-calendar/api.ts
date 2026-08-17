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

function toEventBody(payload: CalendarEventPayload) {
  const nextDay = addOneDay(payload.date);
  return {
    summary: payload.summary,
    description: payload.description,
    start: { date: payload.date },
    end: { date: nextDay },
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
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export async function upsertGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  googleEventId: string | null,
  payload: CalendarEventPayload,
): Promise<string> {
  const body = toEventBody(payload);

  if (googleEventId) {
    try {
      const updated = await googleJson<{ id?: string }>(
        accessToken,
        `${calendarPath(calendarId, `/events/${encodeURIComponent(googleEventId)}`)}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
      if (updated.id) return updated.id;
    } catch (error) {
      if ((error as { status?: number }).status !== 404) {
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
