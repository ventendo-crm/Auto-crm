"use client";

import { DealStageType } from "@prisma/client";
import { BellRing, Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyWorkspace } from "@/hooks/use-company-workspace";
import { api } from "@/lib/api-client";
import {
  formatReminderMoment,
  isStageReminderStage,
  STAGE_REMINDER_INTERVAL_PRESETS,
  STAGE_REMINDER_MAX_DAYS,
  STAGE_REMINDER_MIN_DAYS,
  STAGE_REMINDER_STAGES,
} from "@/lib/preparation-reminders/message";
import { DealStageReminderSettings } from "@/lib/types";

const PRESET_LABELS: Record<(typeof STAGE_REMINDER_INTERVAL_PRESETS)[number], string> = {
  1: "Каждый день",
  2: "Каждые 2 дня",
  3: "Каждые 3 дня",
  5: "Каждые 5 дней",
  7: "Каждые 7 дней",
};

interface DealStageRemindersProps {
  dealId: string;
  currentStage: DealStageType;
  canManage?: boolean;
}

export function DealStageReminders({ dealId, currentStage, canManage = false }: DealStageRemindersProps) {
  const { settings } = useCompanyWorkspace();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [intervalChoice, setIntervalChoice] = useState<string>("1");
  const [customDays, setCustomDays] = useState("4");
  const [saved, setSaved] = useState<DealStageReminderSettings | null>(null);

  const apply = useCallback((data: DealStageReminderSettings) => {
    setSaved(data);
    setEnabled(data.enabled);
    if ((STAGE_REMINDER_INTERVAL_PRESETS as readonly number[]).includes(data.intervalDays)) {
      setIntervalChoice(String(data.intervalDays));
    } else {
      setIntervalChoice("custom");
      setCustomDays(String(data.intervalDays));
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      apply(await api.deals.getStageReminder(dealId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить напоминания");
    } finally {
      setLoading(false);
    }
  }, [apply, dealId]);

  useEffect(() => {
    void load();
  }, [load, currentStage]);

  const intervalDays = intervalChoice === "custom" ? Number(customDays) : Number(intervalChoice);
  const intervalValid =
    Number.isInteger(intervalDays) &&
    intervalDays >= STAGE_REMINDER_MIN_DAYS &&
    intervalDays <= STAGE_REMINDER_MAX_DAYS;

  const stageNames = STAGE_REMINDER_STAGES.map(
    (stage) => settings.stageLabels[stage] ?? stage,
  ).join(", ");

  const handleSave = async () => {
    if (!intervalValid) {
      toast.error(`Интервал — целое число дней от ${STAGE_REMINDER_MIN_DAYS} до ${STAGE_REMINDER_MAX_DAYS}`);
      return;
    }
    setSaving(true);
    try {
      const updated = await api.deals.saveStageReminder(dealId, {
        enabled,
        intervalDays,
      });
      apply(updated);
      toast.success("Напоминания сохранены");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить напоминания");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-4 w-4" />
          Напоминания
        </CardTitle>
        <CardDescription>
          Автоматические напоминания менеджеру сделки на этапах {stageNames}. На остальных этапах
          не отправляются.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
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
                disabled={!canManage || saving}
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
                disabled={!canManage || saving}
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
                  disabled={!canManage || saving}
                  onChange={(event) => setCustomDays(event.target.value)}
                  aria-label="Свой интервал в днях"
                />
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              {saved.nextAt && isStageReminderStage(currentStage) && saved.enabled
                ? `Следующее напоминание: ${formatReminderMoment(new Date(saved.nextAt))} МСК`
                : enabled
                  ? `На этом этапе напоминания не отправляются. Они начнутся после перехода на ${stageNames}.`
                  : "Следующее напоминание не запланировано."}
            </p>

            {!saved.hasManager && enabled && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Менеджер не назначен. Напоминание никому не уйдёт, пока на сделку не назначат
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

            {canManage && (
              <Button type="button" variant="brand" disabled={saving} onClick={() => void handleSave()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Сохранить
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
