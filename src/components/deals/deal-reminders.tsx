"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { ReminderItem } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function isOverdue(reminder: ReminderItem): boolean {
  if (reminder.completed) return false;
  const due = new Date(reminder.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

interface DealRemindersProps {
  dealId: string;
  canManage?: boolean;
}

export function DealReminders({ dealId, canManage = false }: DealRemindersProps) {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.reminders.listByDeal(dealId);
      setReminders(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить напоминания");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !dueDate) {
      toast.error("Заполните текст и дату");
      return;
    }

    setSaving(true);
    try {
      await api.reminders.create(dealId, { title: title.trim(), dueDate });
      setTitle("");
      setDueDate("");
      await load();
      toast.success("Напоминание добавлено");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать напоминание");
    } finally {
      setSaving(false);
    }
  };

  const toggleCompleted = async (reminder: ReminderItem) => {
    try {
      await api.reminders.update(reminder.id, { completed: !reminder.completed });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обновить");
    }
  };

  const removeReminder = async (id: string) => {
    try {
      await api.reminders.delete(id);
      await load();
      toast.success("Напоминание удалено");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить");
    }
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-card">
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const active = reminders.filter((item) => !item.completed);
  const completed = reminders.filter((item) => item.completed);

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Напоминания
        </CardTitle>
        <CardDescription>Задачи и дедлайны по этой сделке</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && (
          <form onSubmit={handleCreate} className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <div className="space-y-2">
              <Label htmlFor={`reminder-title-${dealId}`}>Что сделать</Label>
              <Input
                id={`reminder-title-${dealId}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Позвонить клиенту, запросить оплату..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`reminder-date-${dealId}`}>Срок</Label>
              <Input
                id={`reminder-date-${dealId}`}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <Button type="submit" variant="brand" size="sm" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Добавить
            </Button>
          </form>
        )}

        {active.length === 0 && completed.length === 0 && (
          <p className="text-sm text-muted-foreground">Напоминаний пока нет</p>
        )}

        {active.length > 0 && (
          <div className="space-y-2">
            {active.map((reminder) => (
              <div
                key={reminder.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{reminder.title}</p>
                    {isOverdue(reminder) && (
                      <Badge variant="outline" className="border-rose-200 text-rose-700">
                        Просрочено
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    До {formatDate(reminder.dueDate)}
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Выполнено"
                      onClick={() => void toggleCompleted(reminder)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Удалить"
                      onClick={() => void removeReminder(reminder.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {completed.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Выполнено</p>
            {completed.map((reminder) => (
              <div
                key={reminder.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-3 opacity-70"
              >
                <div>
                  <p className="text-sm line-through">{reminder.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(reminder.dueDate)}</p>
                </div>
                {canManage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Удалить"
                    onClick={() => void removeReminder(reminder.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
