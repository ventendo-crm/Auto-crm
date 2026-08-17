import { prisma } from "@/lib/prisma";
import {
  ensureImportCrmCalendar,
} from "@/lib/google-calendar/api";
import { isGoogleCalendarOAuthConfigured } from "@/lib/google-calendar/config";
import { encryptSecret } from "@/lib/google-calendar/crypto";
import {
  buildGoogleAuthUrl,
  createGoogleOAuthState,
  exchangeGoogleAuthCode,
  fetchGoogleAccountEmail,
  normalizeGoogleEmail,
  verifyGoogleOAuthState,
} from "@/lib/google-calendar/oauth";
import { scheduleCompanyBackfill } from "@/lib/google-calendar/sync";
import { CompanyGoogleCalendarSettings } from "@/lib/types";

export function serializeGoogleCalendarSettings(input: {
  connected: boolean;
  googleEmail: string | null;
  connectedAt: Date | string | null;
  lastSyncAt: Date | string | null;
  lastSyncError: string | null;
}): CompanyGoogleCalendarSettings {
  return {
    configured: isGoogleCalendarOAuthConfigured(),
    connected: input.connected,
    googleEmail: input.googleEmail,
    connectedAt: input.connectedAt
      ? typeof input.connectedAt === "string"
        ? input.connectedAt
        : input.connectedAt.toISOString()
      : null,
    lastSyncAt: input.lastSyncAt
      ? typeof input.lastSyncAt === "string"
        ? input.lastSyncAt
        : input.lastSyncAt.toISOString()
      : null,
    lastSyncError: input.lastSyncError,
  };
}

export async function getCompanyGoogleCalendarSettings(
  companyId: string,
): Promise<CompanyGoogleCalendarSettings> {
  const row = await prisma.companyGoogleCalendarSettings.findUnique({
    where: { companyId },
  });

  if (!row) {
    return serializeGoogleCalendarSettings({
      connected: false,
      googleEmail: null,
      connectedAt: null,
      lastSyncAt: null,
      lastSyncError: null,
    });
  }

  return serializeGoogleCalendarSettings({
    connected: true,
    googleEmail: row.googleEmail,
    connectedAt: row.connectedAt,
    lastSyncAt: row.lastSyncAt,
    lastSyncError: row.lastSyncError,
  });
}

export async function startGoogleCalendarConnect(params: {
  companyId: string;
  userId: string;
  googleEmail: string;
}): Promise<string> {
  if (!isGoogleCalendarOAuthConfigured()) {
    throw new Error("Google Calendar не настроен на сервере. Задайте GOOGLE_CALENDAR_CLIENT_ID и GOOGLE_CALENDAR_CLIENT_SECRET.");
  }

  const googleEmail = normalizeGoogleEmail(params.googleEmail);
  const state = await createGoogleOAuthState({
    companyId: params.companyId,
    userId: params.userId,
    googleEmail,
  });

  return buildGoogleAuthUrl(state, googleEmail);
}

export async function completeGoogleCalendarConnect(params: {
  companyId: string;
  userId: string;
  code: string;
  state: string;
}): Promise<{ googleEmail: string }> {
  const payload = await verifyGoogleOAuthState(params.state);
  if (
    !payload ||
    payload.companyId !== params.companyId ||
    payload.userId !== params.userId
  ) {
    throw new Error("Сессия подключения Google устарела. Начните подключение заново.");
  }

  const tokens = await exchangeGoogleAuthCode(params.code);
  const googleEmail = await fetchGoogleAccountEmail(tokens.accessToken);

  if (googleEmail !== payload.googleEmail) {
    throw new Error(
      `Нужно войти в Google как ${payload.googleEmail}. Сейчас выбран ${googleEmail}.`,
    );
  }

  if (!tokens.refreshToken) {
    const existing = await prisma.companyGoogleCalendarSettings.findUnique({
      where: { companyId: params.companyId },
    });
    if (!existing) {
      throw new Error(
        "Google не выдал refresh token. Отключите доступ ImportCRM в аккаунте Google и подключите календарь ещё раз.",
      );
    }
  }

  const existing = await prisma.companyGoogleCalendarSettings.findUnique({
    where: { companyId: params.companyId },
  });
  const calendarId = await ensureImportCrmCalendar(tokens.accessToken, existing?.calendarId);
  const refreshTokenEnc = tokens.refreshToken
    ? encryptSecret(tokens.refreshToken)
    : existing?.refreshTokenEnc;

  if (!refreshTokenEnc) {
    throw new Error("Не удалось сохранить токен Google. Подключите календарь ещё раз.");
  }

  await prisma.companyGoogleCalendarSettings.upsert({
    where: { companyId: params.companyId },
    create: {
      companyId: params.companyId,
      googleEmail,
      refreshTokenEnc,
      accessTokenEnc: encryptSecret(tokens.accessToken),
      accessTokenExpiresAt: tokens.expiresAt,
      calendarId,
      connectedAt: new Date(),
      lastSyncError: null,
    },
    update: {
      googleEmail,
      refreshTokenEnc,
      accessTokenEnc: encryptSecret(tokens.accessToken),
      accessTokenExpiresAt: tokens.expiresAt,
      calendarId,
      connectedAt: new Date(),
      lastSyncError: null,
    },
  });

  scheduleCompanyBackfill(params.companyId);
  return { googleEmail };
}

export async function disconnectGoogleCalendar(companyId: string): Promise<void> {
  await prisma.googleCalendarEventMap.deleteMany({ where: { companyId } });
  await prisma.companyGoogleCalendarSettings.deleteMany({ where: { companyId } });
}
