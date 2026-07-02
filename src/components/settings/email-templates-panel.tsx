"use client";

import { Loader2, Mail, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { EMAIL_TEMPLATE_PLACEHOLDERS } from "@/lib/email/templates";
import { EmailTemplateItem } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const TEMPLATE_ORDER = ["CLIENT_STAGE", "CLIENT_COMMENT", "CLIENT_TEST"] as const;

export function EmailTemplatesPanel() {
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string>(TEMPLATE_ORDER[0]);
  const [forms, setForms] = useState<
    Record<string, { subject: string; htmlTitle: string; textBody: string }>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.email.listTemplates();
      setTemplates(data);
      setForms(
        Object.fromEntries(
          data.map((item) => [
            item.key,
            { subject: item.subject, htmlTitle: item.htmlTitle, textBody: item.textBody },
          ]),
        ),
      );
      if (data.length > 0 && !data.some((item) => item.key === activeKey)) {
        setActiveKey(data[0].key);
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
    if (activeKey in EMAIL_TEMPLATE_PLACEHOLDERS) {
      return EMAIL_TEMPLATE_PLACEHOLDERS[activeKey as keyof typeof EMAIL_TEMPLATE_PLACEHOLDERS];
    }
    return [];
  }, [activeKey]);

  const updateField = (field: "subject" | "htmlTitle" | "textBody", value: string) => {
    setForms((current) => ({
      ...current,
      [activeKey]: {
        ...current[activeKey],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    const form = forms[activeKey];
    if (!form) return;

    setSavingKey(activeKey);
    try {
      const updated = await api.email.updateTemplate(activeKey, form);
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

  if (loading) {
    return (
      <Card className="border-0 shadow-card">
        <CardContent className="space-y-3 py-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" />
          Шаблоны email-писем
        </CardTitle>
        <CardDescription>
          Тексты писем клиентам. Используйте переменные в фигурных скобках, например{" "}
          <code className="rounded bg-muted px-1">{"{{stageLabel}}"}</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                  {placeholders.map((placeholder) => (
                    <Badge key={placeholder} variant="secondary">
                      {`{{${placeholder}}}`}
                    </Badge>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${key}-subject`}>Тема письма</Label>
                  <Input
                    id={`${key}-subject`}
                    value={form.subject}
                    onChange={(e) => updateField("subject", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${key}-html-title`}>Заголовок в HTML-письме</Label>
                  <Input
                    id={`${key}-html-title`}
                    value={form.htmlTitle}
                    onChange={(e) => updateField("htmlTitle", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${key}-body`}>Текст письма</Label>
                  <Textarea
                    id={`${key}-body`}
                    value={form.textBody}
                    onChange={(e) => updateField("textBody", e.target.value)}
                    rows={12}
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
                  onClick={() => void handleSave()}
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
      </CardContent>
    </Card>
  );
}
