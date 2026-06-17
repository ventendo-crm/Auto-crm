"use client";

import { Bell, CheckCheck } from "lucide-react";
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
    <Card className="border-0 shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Уведомления
        </CardTitle>
        <Button variant="outline" size="sm" onClick={markAllRead}>
          <CheckCheck className="h-4 w-4" />
          Прочитать все
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        {!loading &&
          notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border p-3 ${!n.read ? "bg-brand-muted/40 border-brand/20" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{n.title}</p>
                    {!n.read && <Badge variant="brand" className="text-[10px]">Новое</Badge>}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <Button variant="ghost" size="sm" onClick={() => markRead(n.id)}>
                    Прочитано
                  </Button>
                )}
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
