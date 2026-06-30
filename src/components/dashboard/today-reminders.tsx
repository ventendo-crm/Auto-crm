"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { ReminderItem } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function isOverdue(reminder: ReminderItem): boolean {
  const due = new Date(reminder.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export function TodayReminders() {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.reminders.today();
      setReminders(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить напоминания");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markDone = async (reminder: ReminderItem) => {
    try {
      await api.reminders.update(reminder.id, { completed: true });
      setReminders((current) => current.filter((item) => item.id !== reminder.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отметить выполненным");
    }
  };

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Дела на сегодня
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && reminders.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">На сегодня задач нет</p>
        )}

        {!loading &&
          reminders.map((reminder) => (
            <div
              key={reminder.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{reminder.title}</p>
                  {isOverdue(reminder) ? (
                    <Badge variant="outline" className="border-rose-200 text-rose-700">
                      Просрочено
                    </Badge>
                  ) : (
                    <Badge variant="outline">Сегодня</Badge>
                  )}
                </div>
                {reminder.deal && (
                  <Link
                    href={`/deals/${reminder.deal.id}`}
                    className="mt-1 block text-xs text-brand hover:underline"
                  >
                    {reminder.deal.clientName}
                    {reminder.deal.vin ? ` · ${reminder.deal.vin}` : ""}
                  </Link>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Срок: {formatDate(reminder.dueDate)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Выполнено"
                onClick={() => void markDone(reminder)}
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
