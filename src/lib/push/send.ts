import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { ensureWebPushConfigured } from "@/lib/push/vapid";

export interface BrowserPushPayload {
  title: string;
  body: string;
  url?: string;
}

function truncateBody(text: string, maxLength = 240): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) {
    return singleLine;
  }
  return `${singleLine.slice(0, maxLength - 1).trim()}…`;
}

export async function sendBrowserPushToUser(
  userId: string,
  payload: BrowserPushPayload,
): Promise<void> {
  if (!ensureWebPushConfigured()) {
    return;
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  if (subscriptions.length === 0) {
    return;
  }

  const message = JSON.stringify({
    title: payload.title,
    body: truncateBody(payload.body),
    url: payload.url ?? "/settings",
  });

  const staleIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          message,
        );
      } catch (error) {
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : undefined;

        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(subscription.id);
          return;
        }

        console.error(
          "[push] delivery failed:",
          subscription.endpoint.slice(0, 48),
          error instanceof Error ? error.message : error,
        );
      }
    }),
  );

  if (staleIds.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: staleIds } },
    });
  }
}

