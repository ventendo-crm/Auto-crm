"use client";

import { DealStageType } from "@prisma/client";
import { Bell, Check, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyWorkspace } from "@/hooks/use-company-workspace";
import { api } from "@/lib/api-client";
import {
  DEFAULT_STAGE_REMINDER_TIME,
  DEFAULT_STAGE_REMINDER_TIMEZONE,
  formatReminderMoment,
  isStageReminderStage,
  parseStageReminderSendTime,
  STAGE_REMINDER_INTERVAL_PRESETS,
  STAGE_REMINDER_MAX_DAYS,
  STAGE_REMINDER_MIN_DAYS,
  STAGE_REMINDER_STAGES,
  STAGE_REMINDER_TIMEZONES,
  stageReminderTimeZoneLabel,
} from "@/lib/preparation-reminders/message";
import { DealStageReminderSettings, ReminderItem } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const PRESET_LABELS: Record<(typeof STAGE_REMINDER_INTERVAL_PRESETS)[number], string> = {
  1: "Каждый день",
  2: "Каждые 2 дня",
  3: "Каждые 3 дня",
  5: "Каждые 5 дней",
  7: "Каждые 7 дней",
};

function isOverdue(reminder: ReminderItem): boolean {
  if (reminder.completed) return false;
  const due = new Date(reminder.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

interface DealTasksAndRemindersProps {
  dealId: string;
  currentStage: DealStageType;
  canManageSettings?: boolean;
  canManageTasks?: boolean;
}

export function DealTasksAndReminders({
  dealId,
  currentStage,
  canManageSettings = false,
  canManageTasks = false,
}: DealTasksAndRemindersProps) {
  const { settings } = useCompanyWorkspace();
  const [tasksLoading, setTasksLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [intervalChoice, setIntervalChoice] = useState<string>("1");
  const [customDays, setCustomDays] = useState("4");
  const [sendTime, setSendTime] = useState(DEFAULT_STAGE_REMINDER_TIME);
  const [timeZone, setTimeZone] = useState<string>(DEFAULT_STAGE_REMINDER_TIMEZONE);
  const [saved, setSaved] = useState<DealStageReminderSettings | null>(null);

  const applySettings = useCallback((data: DealStageReminderSettings) => {
    setSaved(data);
    setEnabled(data.enabled);
    setSendTime(data.sendTime || DEFAULT_STAGE_REMINDER_TIME);
    setTimeZone(data.timeZone || DEFAULT_STAGE_REMINDER_TIMEZONE);
    if ((STAGE_REMINDER_INTERVAL_PRESETS as readonly number[]).includes(data.intervalDays)) {
      setIntervalChoice(String(data.intervalDays));
    } else {
      setIntervalChoice("custom");
      setCustomDays(String(data.intervalDays));
    }
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      setReminders(await api.reminders.listByDeal(dealId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить задачи");
    } finally {
      setTasksLoading(false);
    }
  }, [dealId]);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      applySettings(await api.deals.getStageReminder(dealId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить напоминания");
    } finally {
      setSettingsLoading(false);
    }
  }, [applySettings, dealId]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings, currentStage]);

  const intervalDays = intervalChoice === "custom" ? Number(customDays) : Number(intervalChoice);
  const intervalValid =
    Number.isInteger(intervalDays) &&
    intervalDays >= STAGE_REMINDER_MIN_DAYS &&
    intervalDays <= STAGE_REMINDER_MAX_DAYS;

  const stageNames = STAGE_REMINDER_STAGES.map(
    (stage) => settings.stageLabels[stage] ?? stage,
  ).join(", ");

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !dueDate) {
      toast.error("Заполните текст и дату");
      return;
    }

    setCreating(true);
    try {
      await api.reminders.create(dealId, { title: title.trim(), dueDate });
      setTitle("");
      setDueDate("");
      await loadTasks();
      toast.success("Задача добавлена");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать задачу");
    } finally {
      setCreating(false);
    }
  };

  const toggleCompleted = async (reminder: ReminderItem) => {
    try {
      await api.reminders.update(reminder.id, { completed: !reminder.completed });
      await loadTasks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обновить");
    }
  };

  const removeReminder = async (id: string) => {
    try {
      await api.reminders.delete(id);
      await loadTasks();
      toast.success("Задача удалена");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить");
    }
  };

  const handleSave = async () => {
    if (!intervalValid) {
      toast.error(`Интервал — целое число дней от ${STAGE_REMINDER_MIN_DAYS} до ${STAGE_REMINDER_MAX_DAYS}`);
      return;
    }
    if (!parseStageReminderSendTime(sendTime)) {
      toast.error("Укажите время отправки");
      return;
    }
    setSaving(true);
    try {
      const updated = await api.deals.saveStageReminder(dealId, {
        enabled,
        intervalDays,
        sendTime,
        timeZone,
      });
      applySettings(updated);
      toast.success("Напоминания сохранены");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить напоминания");
    } finally {
      setSaving(false);
    }
  };

  const active = reminders.filter((item) => !item.completed);
  const completed = reminders.filter((item) => item.completed);
  const fieldsDisabled = !canManageSettings || saving;

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Задачи и напоминания
        </CardTitle>
        <CardDescription>
          Задачи по сделке и автоматические напоминания менеджеру. Время и часовой пояс общие:
          в этот час в день срока уходит задача, а на этапах {stageNames} — повторные напоминания.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {settingsLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`reminder-time-${dealId}`}>Время отправки</Label>
              <Input
                id={`reminder-time-${dealId}`}
                type="time"
                step={60}
                value={sendTime}
                disabled={fieldsDisabled}
                onChange={(event) => setSendTime(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Часовой пояс</Label>
              <Select value={timeZone} disabled={fieldsDisabled} onValueChange={setTimeZone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_REMINDER_TIMEZONES.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <Separator />

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Задачи</p>
            <p className="text-xs text-muted-foreground">
              В день срока в указанное время назначенный менеджер получит сообщение в Telegram и в
              Настройки → Уведомления.
            </p>
          </div>

          {canManageTasks && (
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
              <Button type="submit" variant="brand" size="sm" disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Добавить
              </Button>
            </form>
          )}

          {tasksLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : active.length === 0 && completed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Задач пока нет</p>
          ) : (
            <>
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
                      {canManageTasks && (
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
                      {canManageTasks && (
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
            </>
          )}
        </div>

        <Separator />

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">Автоматические напоминания</p>
            <p className="text-xs text-muted-foreground">
              Повторные сообщения менеджеру на этапах {stageNames}. На остальных этапах не
              отправляются.
            </p>
          </div>

          {settingsLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : !saved ? (
            <p className="text-sm text-muted-foreground">Не удалось показать настройки напоминаний.</p>
          ) : (
            <>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
                  checked={enabled}
                  disabled={fieldsDisabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                />
                <span className="min-w-0">
                  <span className="text-sm font-medium leading-snug">Автоматические напоминания</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {enabled ? "Включены" : "Выключены"}. Для новой сделки по умолчанию выключены.
                  </span>
                </span>
              </label>

              <div className="space-y-2">
                <Label>Периодичность напоминаний</Label>
                <Select
                  value={intervalChoice}
                  disabled={fieldsDisabled}
                  onValueChange={setIntervalChoice}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGE_REMINDER_INTERVAL_PRESETS.map((days) => (
                      <SelectItem key={days} value={String(days)}>
                        {PRESET_LABELS[days]}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Свой интервал</SelectItem>
                  </SelectContent>
                </Select>
                {intervalChoice === "custom" && (
                  <Input
                    type="number"
                    min={STAGE_REMINDER_MIN_DAYS}
                    max={STAGE_REMINDER_MAX_DAYS}
                    step={1}
                    value={customDays}
                    disabled={fieldsDisabled}
                    onChange={(event) => setCustomDays(event.target.value)}
                    aria-label="Свой интервал в днях"
                  />
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                {saved.nextAt && isStageReminderStage(currentStage) && saved.enabled
                  ? `Следующее напоминание: ${formatReminderMoment(new Date(saved.nextAt), saved.timeZone)}, ${stageReminderTimeZoneLabel(saved.timeZone)}`
                  : enabled
                    ? `На этом этапе напоминания не отправляются. Они начнутся после перехода на ${stageNames}.`
                    : "Следующее напоминание не запланировано."}
              </p>

              {!saved.hasManager && (enabled || active.length > 0) && (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Менеджер не назначен. Уведомление никому не уйдёт, пока на сделку не назначат
                  ответственного.
                </p>
              )}
              {saved.managersMissingTelegram.length > 0 && (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  У {saved.managersMissingTelegram.map((manager) => manager.name).join(", ")} нет
                  Chat ID в профиле. В Telegram сообщение не придёт, пока менеджер не привяжет бота
                  в Настройки → Профиль.
                </p>
              )}
            </>
          )}
        </div>

        {canManageSettings && (
          <Button type="button" variant="brand" disabled={saving || settingsLoading} onClick={() => void handleSave()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Сохранить
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
