export const OFFER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const OFFER_MAX_PHOTOS = 15;
export const OFFER_MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const OFFER_MAX_TOTAL_BYTES = 90 * 1024 * 1024;
export const OFFER_DESCRIPTION_MAX = 4000;
export const OFFER_TOKEN_PATTERN = /^[a-f0-9]{48}$/;

export type PublicCalculatorOffer = {
  companyName: string;
  description: string;
  sourceUrl: string | null;
  totalLabel: string | null;
  photoUrls: string[];
  estimateUrl: string | null;
  expiresAt: string;
};

export type CreatedCalculatorOffer = {
  token: string;
  expiresAt: string;
};

export function isOfferShareToken(token: string): boolean {
  return OFFER_TOKEN_PATTERN.test(token.trim());
}

export function publicOfferPath(token: string): string {
  return `/o/${token}`;
}

export function publicOfferFilePath(token: string, fileName: string): string {
  return `/api/public/offers/${token}/files/${encodeURIComponent(fileName)}`;
}

export function resolvePublicOfferAbsoluteUrl(token: string): string {
  const path = publicOfferPath(token);
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return `${fromEnv.replace(/\/$/, "")}${path}`;
  if (typeof window !== "undefined") return `${window.location.origin}${path}`;
  return path;
}

export function buildTelegramShareUrl(url: string, text: string): string {
  const params = new URLSearchParams();
  params.set("url", url);
  if (text.trim()) params.set("text", text.trim());
  return `https://t.me/share/url?${params.toString()}`;
}

export function sanitizeOfferHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
