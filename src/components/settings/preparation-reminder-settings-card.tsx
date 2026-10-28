"use client";

import { BellRing, Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyWorkspace } from "@/hooks/use-company-workspace";
import { api } from "@/lib/api-client";
import {
  DEFAULT_PREPARATION_REMINDER_TEMPLATE,
  PREPARATION_REMINDER_INTERVAL_PRESETS,
  PREPARATION_REMINDER_MAX_HOURS,
  PREPARATION_REMINDER_MIN_HOURS,
  PREPARATION_REMINDER_PLACEHOLDERS,
  STAGE_REMINDER_STAGES,
} from "@/lib/preparation-reminders/message";
import { PreparationReminderSettings, User } from "@/lib/types";

const PRESET_LABELS: Record<(typeof PREPARATION_REMINDER_INTERVAL_PRESETS)[number], string> = {
  1: "Каждый час",
  6: "Каждые 6 часов",
  12: "Каждые 12 часов",
  24: "Каждые 24 часа",
  48: "Каждые 48 часов",
  72: "Каждые 72 часа",
};

type IntervalChoice = (typeof PREPARATION_REMINDER_INTERVAL_PRESETS)[number] | "custom";

function intervalChoiceFor(hours: number): IntervalChoice {
  return (PREPARATION_REMINDER_INTERVAL_PRESETS as readonly number[]).includes(hours)
    ? (hours as IntervalChoice)
    : "custom";
}

export function PreparationReminderSettingsCard() {
  const { settings: workspace } = useCompanyWorkspace();
  const stageNames = STAGE_REMINDER_STAGES.map((stage) => workspace.stageLabels[stage]);
  const stageList = stageNames.join("», «");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [intervalHours, setIntervalHours] = useState(24);
  const [intervalChoice, setIntervalChoice] = useState<IntervalChoice>(24);
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_PREPARATION_REMINDER_TEMPLATE);
  const [recipientMode, setRecipientMode] = useState<PreparationReminderSettings["recipientMode"]>("ASSIGNED");
  const [specificManagerId, setSpecificManagerId] = useState<string>("");
  const [managers, setManagers] = useState<User[]>([]);
  const [botConnected, setBotConnected] = useState(true);

  const applySettings = useCallback((data: PreparationReminderSettings) => {
    setEnabled(data.enabled);
    setIntervalHours(data.intervalHours);
    setIntervalChoice(intervalChoiceFor(data.intervalHours));
    setMessageTemplate(data.messageTemplate);
    setRecipientMode(data.recipientMode);
    setSpecificManagerId(data.specificManagerId ?? "");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, users, bot] = await Promise.all([
        api.telegram.getPreparationReminders(),
        api.users.list(),
        api.telegram.getBotSettings(),
      ]);
      applySettings(data);
      setManagers(users.filter((user) => user.role.name === "MANAGER"));
      setBotConnected(bot.connected);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить напоминания");
    } finally {
      setLoading(false);
    }
  }, [applySettings]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedManager = useMemo(
    () => managers.find((manager) => manager.id === specificManagerId) ?? null,
    [managers, specificManagerId],
  );

  const handleSave = async () => {
    if (recipientMode === "SPECIFIC" && !specificManagerId) {
      toast.error("Выберите менеджера");
      return;
    }

    const hours = Math.round(intervalHours);
    if (
      !Number.isFinite(hours) ||
      hours < PREPARATION_REMINDER_MIN_HOURS ||
      hours > PREPARATION_REMINDER_MAX_HOURS
    ) {
      toast.error(`Периодичность — от ${PREPARATION_REMINDER_MIN_HOURS} до ${PREPARATION_REMINDER_MAX_HOURS} часов`);
      return;
    }

    setSaving(true);
    try {
      const updated = await api.telegram.savePreparationReminders({
        enabled,
        intervalHours: hours,
        messageTemplate,
        recipientMode,
        specificManagerId: specificManagerId || null,
      });
      applySettings(updated);
      toast.success("Напоминания сохранены");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить напоминания");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-4 w-4" />
          Напоминания на этапах «{stageList}»
          {enabled ? <Badge>Включены</Badge> : <Badge variant="secondary">Выключены</Badge>}
        </CardTitle>
        <CardDescription>
          Пока сделка на одном из этих этапов, выбранному менеджеру в Telegram приходит
          напоминание написать клиенту статус его авто. Первое сообщение — сразу при переходе
          на этап, дальше — с выбранной периодичностью. При смене этапа между ними отсчёт
          начинается заново. На остальных этапах напоминания не отправляются.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!botConnected && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Бот компании ещё не привязан. Настройки можно сохранить, но сообщения в Telegram
            уйдут только после привязки бота.
          </p>
        )}

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input accent-primary"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Включить напоминания
        </label>

        <div className="space-y-2">
          <Label htmlFor="preparation-reminder-interval">Периодичность уведомлений</Label>
          <Select
            value={String(intervalChoice)}
            onValueChange={(value) => {
              if (value === "custom") {
                setIntervalChoice("custom");
                return;
              }
              const hours = Number(value);
              if (!(PREPARATION_REMINDER_INTERVAL_PRESETS as readonly number[]).includes(hours)) {
                return;
              }
              setIntervalChoice(hours as IntervalChoice);
              setIntervalHours(hours);
            }}
          >
            <SelectTrigger id="preparation-reminder-interval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PREPARATION_REMINDER_INTERVAL_PRESETS.map((hours) => (
                <SelectItem key={hours} value={String(hours)}>
                  {PRESET_LABELS[hours]}
                </SelectItem>
              ))}
              <SelectItem value="custom">Свой интервал</SelectItem>
            </SelectContent>
          </Select>
          {intervalChoice === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                id="preparation-reminder-hours"
                type="number"
                min={PREPARATION_REMINDER_MIN_HOURS}
                max={PREPARATION_REMINDER_MAX_HOURS}
                value={intervalHours}
                onChange={(event) => setIntervalHours(Number(event.target.value))}
              />
              <span className="text-sm text-muted-foreground">часов</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="preparation-reminder-recipient">Кому отправлять</Label>
          <Select
            value={recipientMode}
            onValueChange={(value) =>
              setRecipientMode(value as PreparationReminderSettings["recipientMode"])
            }
          >
            <SelectTrigger id="preparation-reminder-recipient">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ASSIGNED">Менеджеры, назначенные на сделку</SelectItem>
              <SelectItem value="SPECIFIC">Один менеджер</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Личное сообщение уходит менеджеру с Chat ID в профиле. Общий служебный чат компании
            это напоминание не получает. Если Telegram не привязан, запись всё равно появится в
            уведомлениях CRM.
          </p>
        </div>

        {recipientMode === "SPECIFIC" && (
          <div className="space-y-2">
            <Label htmlFor="preparation-reminder-manager">Менеджер</Label>
            <Select
              value={specificManagerId || undefined}
              onValueChange={setSpecificManagerId}
            >
              <SelectTrigger id="preparation-reminder-manager">
                <SelectValue placeholder="Выберите менеджера" />
              </SelectTrigger>
              <SelectContent>
                {managers.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id}>
                    {manager.name}
                    {manager.telegramChatId ? "" : " — Telegram не привязан"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {managers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                В компании пока нет менеджеров. Добавьте их в Настройки → Менеджеры.
              </p>
            )}
            {selectedManager && !selectedManager.telegramChatId && (
              <p className="text-xs text-muted-foreground">
                У {selectedManager.name} нет Chat ID. Попросите открыть Настройки → Профиль и
                привязать Telegram — иначе сообщение в мессенджер не дойдёт.
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="preparation-reminder-text">Текст напоминания</Label>
          <Textarea
            id="preparation-reminder-text"
            rows={8}
            value={messageTemplate}
            onChange={(event) => setMessageTemplate(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Переменные:{" "}
            {PREPARATION_REMINDER_PLACEHOLDERS.map((name) => (
              <code key={name} className="mr-1 rounded bg-muted px-1">
                {`{{${name}}}`}
              </code>
            ))}
          </p>
        </div>

        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Сохранить
        </Button>
      </CardContent>
    </Card>
  );
}
