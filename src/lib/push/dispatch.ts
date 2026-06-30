import type { BrowserPushPayload } from "@/lib/push/send";
import { sendFcmToUser } from "@/lib/push/fcm";
import { sendBrowserPushToUser } from "@/lib/push/send";

export async function dispatchPushToUser(
  userId: string,
  payload: BrowserPushPayload,
): Promise<void> {
  await Promise.all([
    sendBrowserPushToUser(userId, payload),
    sendFcmToUser(userId, payload),
  ]);
}

export async function sendTestBrowserPush(userId: string, userName: string): Promise<void> {
  await dispatchPushToUser(userId, {
    title: "Auto-CRM",
    body: `${userName}, браузерные уведомления работают.`,
    url: "/settings",
  });
}
