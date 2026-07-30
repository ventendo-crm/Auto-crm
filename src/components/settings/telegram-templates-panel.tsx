"use client";

import { Loader2, Save, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { TELEGRAM_TEMPLATE_PLACEHOLDERS } from "@/lib/telegram/templates";
import { ClientStageMessageItem, TelegramTemplateItem } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const TEMPLATE_ORDER = ["STAGE_CHANGE", "CLIENT_STAGE", "COMMENT", "TEST"] as const;

export function TelegramTemplatesPanel() {
  const [section, setSection] = useState<"templates" | "stages">("stages");
  const [templates, setTemplates] = useState<TelegramTemplateItem[]>([]);
  const [stageMessages, setStageMessages] = useState<ClientStageMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savingStages, setSavingStages] = useState(false);
  const [activeKey, setActiveKey] = useState<string>(TEMPLATE_ORDER[0]);
  const [forms, setForms] = useState<Record<string, { textBody: string }>>({});
  const [stageForms, setStageForms] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [templateData, stageData] = await Promise.all([
        api.telegram.listTemplates(),
        api.telegram.listStageMessages(),
      ]);
      setTemplates(templateData);
      setForms(
        Object.fromEntries(templateData.map((item) => [item.key, { textBody: item.textBody }])),
      );
      setStageMessages(stageData);
      setStageForms(Object.fromEntries(stageData.map((item) => [item.stage, item.textBody])));
      if (templateData.length > 0 && !templateData.some((item) => item.key === activeKey)) {
        setActiveKey(templateData[0].key);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить шаблоны");
    } finally {
      setLoading(false);
    }
  }, [activeKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeTemplate = useMemo(
    () => templates.find((item) => item.key === activeKey) ?? null,
    [activeKey, templates],
  );

  const activeForm = forms[activeKey];

  const placeholders = useMemo(() => {
    if (activeKey in TELEGRAM_TEMPLATE_PLACEHOLDERS) {
      return TELEGRAM_TEMPLATE_PLACEHOLDERS[
        activeKey as keyof typeof TELEGRAM_TEMPLATE_PLACEHOLDERS
      ];
    }
    return [];
  }, [activeKey]);

  const handleSaveTemplate = async () => {
    const form = forms[activeKey];
    if (!form) return;

    setSavingKey(activeKey);
    try {
      const updated = await api.telegram.updateTemplate(activeKey, form);
      setTemplates((current) =>
        current.map((item) => (item.key === activeKey ? { ...item, ...updated } : item)),
      );
      toast.success("Шаблон сохранён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить шаблон");
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveStages = async () => {
    setSavingStages(true);
    try {
      const messages = stageMessages.map((item) => ({
        stage: item.stage,
        textBody: stageForms[item.stage] ?? item.textBody,
      }));
      const updated = await api.telegram.updateStageMessages(messages);
      setStageMessages(updated);
      setStageForms(Object.fromEntries(updated.map((item) => [item.stage, item.textBody])));
      toast.success("Тексты по этапам сохранены");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить тексты");
    } finally {
      setSavingStages(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-card">
        <CardContent className="space-y-3 py-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-4 w-4" />
          Шаблоны Telegram
        </CardTitle>
        <CardDescription>
          Общие шаблоны и отдельные тексты клиенту для каждого этапа сделки. Эти тексты также
          используются в email и уведомлениях в кабинете.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={section} onValueChange={(value) => setSection(value as "templates" | "stages")}>
          <TabsList className="mb-4">
            <TabsTrigger value="stages">Тексты по этапам</TabsTrigger>
            <TabsTrigger value="templates">Общие шаблоны</TabsTrigger>
          </TabsList>

          <TabsContent value="stages" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Текст подставляется в переменную{" "}
              <code className="rounded bg-muted px-1">{"{{body}}"}</code> шаблона «Смена этапа
              (клиент)» — свой для каждого этапа.
            </p>

            {stageMessages.map((item) => (
              <div key={item.stage} className="space-y-2 rounded-lg border p-3">
                <Label htmlFor={`stage-${item.stage}`}>{item.label}</Label>
                <Textarea
                  id={`stage-${item.stage}`}
                  value={stageForms[item.stage] ?? ""}
                  onChange={(e) =>
                    setStageForms((current) => ({
                      ...current,
                      [item.stage]: e.target.value,
                    }))
                  }
                  rows={3}
                />
              </div>
            ))}

            <Button
              type="button"
              variant="brand"
              onClick={() => void handleSaveStages()}
              disabled={savingStages}
            >
              {savingStages ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Сохранить тексты этапов
            </Button>
          </TabsContent>

          <TabsContent value="templates">
            <Tabs value={activeKey} onValueChange={setActiveKey}>
              <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1">
                {TEMPLATE_ORDER.map((key) => {
                  const template = templates.find((item) => item.key === key);
                  if (!template) return null;
                  return (
                    <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
                      {template.name}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {TEMPLATE_ORDER.map((key) => {
                const template = templates.find((item) => item.key === key);
                const form = forms[key];
                if (!template || !form) return null;

                return (
                  <TabsContent key={key} value={key} className="space-y-4">
                    {template.description && (
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {(key === activeKey ? placeholders : []).map((placeholder) => (
                        <Badge key={placeholder} variant="secondary">
                          {`{{${placeholder}}}`}
                        </Badge>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${key}-body`}>Текст сообщения</Label>
                      <Textarea
                        id={`${key}-body`}
                        value={form.textBody}
                        onChange={(e) =>
                          setForms((current) => ({
                            ...current,
                            [key]: { textBody: e.target.value },
                          }))
                        }
                        rows={14}
                        className="font-mono text-sm"
                      />
                    </div>

                    {template.updatedAt && (
                      <p className="text-xs text-muted-foreground">
                        Обновлено: {formatDateTime(template.updatedAt)}
                      </p>
                    )}

                    <Button
                      type="button"
                      variant="brand"
                      onClick={() => void handleSaveTemplate()}
                      disabled={savingKey === key}
                    >
                      {savingKey === key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Сохранить
                    </Button>
                  </TabsContent>
                );
              })}
            </Tabs>

            {activeTemplate && !activeForm && (
              <p className="text-sm text-muted-foreground">Шаблон не найден</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
