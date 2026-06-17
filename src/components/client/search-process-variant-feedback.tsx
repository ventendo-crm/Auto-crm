"use client";

import { Loader2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";

interface SearchProcessVariantFeedbackProps {
  dealId: string;
  entryId: string;
  variantNumber: number;
  initialFeedback?: string | null;
  initialFeedbackAt?: string | null;
  onSaved?: (feedback: string, feedbackAt: string) => void;
}

export function SearchProcessVariantFeedback({
  dealId,
  entryId,
  variantNumber,
  initialFeedback,
  initialFeedbackAt,
  onSaved,
}: SearchProcessVariantFeedbackProps) {
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [feedbackAt, setFeedbackAt] = useState(initialFeedbackAt ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFeedback(initialFeedback ?? "");
    setFeedbackAt(initialFeedbackAt ?? null);
  }, [initialFeedback, initialFeedbackAt]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!feedback.trim()) return;

    setLoading(true);
    try {
      const entry = await api.searchProcess.submitFeedback(dealId, entryId, feedback.trim());
      setFeedback(entry.clientFeedback ?? "");
      setFeedbackAt(entry.clientFeedbackAt ?? null);
      onSaved?.(entry.clientFeedback ?? "", entry.clientFeedbackAt ?? new Date().toISOString());
      toast.success("Обратная связь отправлена");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить обратную связь");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 border-t pt-4">
      <Label htmlFor={`variant-feedback-${entryId}`} className="text-sm font-medium">
        Ваша обратная связь
      </Label>
      <p className="mt-1 text-xs text-muted-foreground">
        Напишите, что думаете о варианте {variantNumber}: нравится, есть вопросы или пожелания.
      </p>

      <form onSubmit={handleSubmit} className="mt-3 space-y-2">
        <Textarea
          id={`variant-feedback-${entryId}`}
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="Например: нравится цвет и комплектация, но хотелось бы узнать пробег..."
          rows={3}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="submit" variant="brand" size="sm" disabled={loading || !feedback.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Отправить
          </Button>
          {feedbackAt && (
            <p className="text-xs text-muted-foreground">
              Обновлено: {formatDateTime(feedbackAt)}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
