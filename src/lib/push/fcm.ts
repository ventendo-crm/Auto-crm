import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { prisma } from "@/lib/prisma";
import type { BrowserPushPayload } from "@/lib/push/send";

let firebaseReady = false;

function truncateBody(text: string, maxLength = 240): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) {
    return singleLine;
  }
  return `${singleLine.slice(0, maxLength - 1).trim()}…`;
}

export function isFcmConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
}

function ensureFirebase(): boolean {
  if (firebaseReady) {
    return true;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    return false;
  }

  try {
    const credentials = JSON.parse(raw) as ServiceAccount;
    if (!getApps().length) {
      initializeApp({
        credential: cert(credentials),
      });
    }
    firebaseReady = true;
    return true;
  } catch (error) {
    console.error("[fcm] Failed to initialize Firebase:", error);
    return false;
  }
}

export async function sendFcmToUser(userId: string, payload: BrowserPushPayload): Promise<void> {
  if (!ensureFirebase()) {
    return;
  }

  const devices = await prisma.fcmDevice.findMany({
    where: { userId },
    select: { id: true, token: true },
  });

  if (devices.length === 0) {
    return;
  }

  const url = payload.url ?? "/settings";
  const body = truncateBody(payload.body);

  const response = await getMessaging().sendEachForMulticast({
    tokens: devices.map((device) => device.token),
    notification: {
      title: payload.title,
      body,
    },
    data: {
      url,
      title: payload.title,
      body,
    },
    android: {
      priority: "high",
      notification: {
        channelId: "importcrm_default",
      },
    },
  });

  const staleIds: string[] = [];

  response.responses.forEach((item, index) => {
    if (item.success) {
      return;
    }

    const code = item.error?.code;
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    ) {
      staleIds.push(devices[index].id);
      return;
    }

    console.error("[fcm] delivery failed:", code, item.error?.message);
  });

  if (staleIds.length > 0) {
    await prisma.fcmDevice.deleteMany({
      where: { id: { in: staleIds } },
    });
  }
}
