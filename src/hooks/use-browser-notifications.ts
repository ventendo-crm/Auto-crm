"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getCurrentPushSubscription,
  isBrowserNotificationSupported,
  registerServiceWorker,
} from "@/lib/browser-notifications";
import { api } from "@/lib/api-client";

type PushState = "unsupported" | "server-off" | "default" | "denied" | "subscribed";

export function useBrowserNotifications() {
  const [state, setState] = useState<PushState>("default");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isBrowserNotificationSupported()) {
      setState("unsupported");
      setLoading(false);
      return;
    }

    try {
      await api.push.getPublicKey();
    } catch {
      setState("server-off");
      setLoading(false);
      return;
    }

    if (Notification.permission === "denied") {
      setState("denied");
      setLoading(false);
      return;
    }

    const subscription = await getCurrentPushSubscription();
    setState(subscription ? "subscribed" : "default");
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isBrowserNotificationSupported() || Notification.permission !== "granted") {
      return;
    }

    void registerServiceWorker().catch(() => undefined);
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "default");
        throw new Error("Разрешение на уведомления не получено");
      }

      const { publicKey } = await api.push.getPublicKey();
      const { subscribeToBrowserPush, serializePushSubscription } = await import(
        "@/lib/browser-notifications"
      );
      const subscription = await subscribeToBrowserPush(publicKey);
      await api.push.subscribe(serializePushSubscription(subscription));
      setState("subscribed");
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const { unsubscribeFromBrowserPush } = await import("@/lib/browser-notifications");
      const subscription = await getCurrentPushSubscription();
      if (subscription) {
        await api.push.unsubscribe({ endpoint: subscription.endpoint });
        await unsubscribeFromBrowserPush();
      } else {
        await api.push.unsubscribe();
      }
      setState(Notification.permission === "denied" ? "denied" : "default");
    } finally {
      setBusy(false);
    }
  }, []);

  const test = useCallback(async () => {
    setBusy(true);
    try {
      await api.push.test();
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    state,
    loading,
    busy,
    enable,
    disable,
    test,
    refresh,
    supported: state !== "unsupported",
    configured: state !== "unsupported" && state !== "server-off",
    subscribed: state === "subscribed",
  };
}
