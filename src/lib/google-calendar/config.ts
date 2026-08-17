import { getAppPublicUrl } from "@/lib/telegram/bot";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

export const GOOGLE_CALENDAR_SCOPES = `${CALENDAR_SCOPE} ${EMAIL_SCOPE}`;
export const GOOGLE_CALENDAR_NAME = "ImportCRM";
export const GOOGLE_CALENDAR_TIMEZONE = "Europe/Moscow";

export function getGoogleCalendarClientId(): string | null {
  return process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() || null;
}

export function getGoogleCalendarClientSecret(): string | null {
  return process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() || null;
}

export function isGoogleCalendarOAuthConfigured(): boolean {
  return Boolean(getGoogleCalendarClientId() && getGoogleCalendarClientSecret());
}

export function getGoogleCalendarRedirectUri(): string {
  return `${getAppPublicUrl()}/api/google-calendar/callback`;
}
