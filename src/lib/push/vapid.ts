import webpush from "web-push";

let configured = false;

export function isPushConfigured(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  return Boolean(publicKey && privateKey);
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

export function ensureWebPushConfigured(): boolean {
  if (configured) {
    return true;
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) {
    return false;
  }

  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@importcrm.ru";
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}
