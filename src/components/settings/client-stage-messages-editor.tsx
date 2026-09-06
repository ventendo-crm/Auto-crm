"use client";

import { Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { ClientStageMessageItem } from "@/lib/types";

export function ClientStageMessagesEditor({ description }: { description?: string }) {
  const [stageMessages, setStageMessages] = useState<ClientStageMessageItem[]>([]);
  const [stageForms, setStageForms] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const stageData = await api.telegram.listStageMessages();
      setStageMessages(stageData);
      setStageForms(Object.fromEntries(stageData.map((item) => [item.stage, item.textBody])));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить тексты этапов");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
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
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Загрузка текстов…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}

      {stageMessages.map((item) => (
        <div key={item.stage} className="space-y-2 rounded-lg border p-3">
          <Label htmlFor={`workspace-stage-${item.stage}`}>{item.label}</Label>
          <Textarea
            id={`workspace-stage-${item.stage}`}
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

      <Button type="button" variant="brand" onClick={() => void handleSave()} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Сохранить тексты этапов
      </Button>
    </div>
  );
}
