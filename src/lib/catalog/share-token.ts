import { createHash, randomBytes } from "crypto";

export function createShareToken(): string {
  return randomBytes(24).toString("hex");
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

function publicAbsoluteUrl(path: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "";
  if (fromEnv) return `${fromEnv.replace(/\/$/, "")}${path}`;
  if (typeof window !== "undefined") return `${window.location.origin}${path}`;
  return path;
}

export function buildPublicSelectionUrl(token: string): string {
  return publicAbsoluteUrl(`/s/${token}`);
}

export function buildPublicCatalogVehiclePath(token: string): string {
  return `/c/${token}`;
}

export function buildPublicCatalogVehicleUrl(token: string): string {
  return publicAbsoluteUrl(buildPublicCatalogVehiclePath(token));
}

export function buildCatalogVehicleCaption(title?: string | null, trimTitles?: string[]) {
  const name = title?.trim() || "";
  const trims = (trimTitles ?? []).map((item) => item.trim()).filter(Boolean);
  const head = name ? `Расчет автомобиля "${name}"` : "Расчет автомобиля";
  const trimPart = trims.length > 0 ? ` в комплектации "${trims.join(", ")}"` : "";
  return `${head}${trimPart}`;
}

export function buildCatalogVehicleClipboard(
  url: string,
  title?: string | null,
  trimTitles?: string[],
) {
  return `${buildCatalogVehicleCaption(title, trimTitles)}\n\n${url}`;
}

export function publicCatalogVehicleMediaPath(token: string, mediaId: string): string {
  return `/api/public/catalog/${token}/media/${encodeURIComponent(mediaId)}`;
}
