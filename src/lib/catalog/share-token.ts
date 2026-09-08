import { createHash, randomBytes } from "crypto";

import { formatCurrency } from "@/lib/utils";

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

export function buildCatalogVehicleClipboard(
  url: string,
  title?: string | null,
  totalRub?: number | null,
) {
  const head = title?.trim() || "Авто из каталога";
  const total =
    totalRub != null && Number.isFinite(totalRub) ? `\nИтого: ${formatCurrency(totalRub)}` : "";
  return `${head}${total}\n\n${url}`;
}

export function publicCatalogVehicleMediaPath(token: string, mediaId: string): string {
  return `/api/public/catalog/${token}/media/${encodeURIComponent(mediaId)}`;
}
