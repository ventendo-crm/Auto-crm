import { SignJWT, jwtVerify } from "jose";
import {
  getGoogleCalendarClientId,
  getGoogleCalendarClientSecret,
  getGoogleCalendarRedirectUri,
  GOOGLE_CALENDAR_SCOPES,
} from "@/lib/google-calendar/config";

const STATE_TTL = "10m";

export type GoogleOAuthState = {
  companyId: string;
  userId: string;
  googleEmail: string;
};

export type GoogleTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
};

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function createGoogleOAuthState(payload: GoogleOAuthState): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(STATE_TTL)
    .sign(getJwtSecret());
}

export async function verifyGoogleOAuthState(token: string): Promise<GoogleOAuthState | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (
      typeof payload.companyId !== "string" ||
      typeof payload.userId !== "string" ||
      typeof payload.googleEmail !== "string"
    ) {
      return null;
    }
    return {
      companyId: payload.companyId,
      userId: payload.userId,
      googleEmail: payload.googleEmail,
    };
  } catch {
    return null;
  }
}

export function buildGoogleAuthUrl(state: string, loginHint: string): string {
  const clientId = getGoogleCalendarClientId();
  if (!clientId) {
    throw new Error("Google Calendar OAuth не настроен на сервере");
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getGoogleCalendarRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  url.searchParams.set("login_hint", loginHint);
  return url.toString();
}

async function readTokenResponse(response: Response): Promise<GoogleTokenSet> {
  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "Не удалось получить токен Google",
    );
  }

  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + Math.max(expiresIn - 60, 60) * 1000),
  };
}

export async function exchangeGoogleAuthCode(code: string): Promise<GoogleTokenSet> {
  const clientId = getGoogleCalendarClientId();
  const clientSecret = getGoogleCalendarClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("Google Calendar OAuth не настроен на сервере");
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: getGoogleCalendarRedirectUri(),
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  return readTokenResponse(response);
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleTokenSet> {
  const clientId = getGoogleCalendarClientId();
  const clientSecret = getGoogleCalendarClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("Google Calendar OAuth не настроен на сервере");
  }

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const tokens = await readTokenResponse(response);
  return {
    ...tokens,
    refreshToken: tokens.refreshToken ?? refreshToken,
  };
}

export async function fetchGoogleAccountEmail(accessToken: string): Promise<string> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await response.json()) as { email?: string; error?: { message?: string } };

  if (!response.ok || !data.email) {
    throw new Error(data.error?.message || "Не удалось прочитать Google-аккаунт");
  }

  return data.email.trim().toLowerCase();
}

export function normalizeGoogleEmail(value: string): string {
  return value.trim().toLowerCase();
}
