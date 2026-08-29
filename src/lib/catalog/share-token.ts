import { createHash, randomBytes } from "crypto";

export function createShareToken(): string {
  return randomBytes(24).toString("hex");
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function buildPublicSelectionUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "";
  const path = `/s/${token}`;
  return base ? `${base.replace(/\/$/, "")}${path}` : path;
}
