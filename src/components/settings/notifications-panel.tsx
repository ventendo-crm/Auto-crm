"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { NotificationItem } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function NotificationsPanel() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.notifications.list({ limit: 50 });
      setNotifications(result.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: string) => {
    try {
      await api.notifications.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    }
  };

  const markAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success("Все уведомления прочитаны");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    }
  };

  return (
    <Card className="min-w-0 overflow-hidden border-0 shadow-card">
      <CardHeader className="flex flex-col gap-3 space-y-0 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <CardTitle className="flex min-w-0 items-center gap-2 text-base">
          <Bell className="h-4 w-4 shrink-0" />
          Уведомления
        </CardTitle>
        <Button variant="outline" size="sm" className="w-full shrink-0 sm:w-auto" onClick={markAllRead}>
          <CheckCheck className="h-4 w-4" />
          Прочитать все
        </Button>
      </CardHeader>
      <CardContent className="min-w-0 space-y-2 p-4 pt-0 sm:p-6 sm:pt-0">
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        {!loading &&
          notifications.map((n) => (
            <div
              key={n.id}
              className={`min-w-0 overflow-hidden rounded-lg border p-3 ${!n.read ? "bg-brand-muted/40 border-brand/20" : ""}`}
            >
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <p className="break-words text-sm font-medium">{n.title}</p>
                    {!n.read && (
                      <Badge variant="brand" className="shrink-0 text-[10px]">
                        Новое
                      </Badge>
                    )}
                  </div>
                  {!n.read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 px-2 sm:px-3"
                      onClick={() => markRead(n.id)}
                    >
                      Прочитано
                    </Button>
                  )}
                </div>
                <p className="whitespace-pre-line break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {n.message}
                </p>
                {n.dealId && (
                  <Link
                    href={`/deals/${n.dealId}`}
                    className="inline-block text-sm text-brand hover:underline"
                  >
                    Открыть сделку
                  </Link>
                )}
                <p className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
              </div>
            </div>
          ))}
        {!loading && notifications.length === 0 && (
          <p className="text-sm text-muted-foreground">Уведомлений нет</p>
        )}
      </CardContent>
    </Card>
  );
}
