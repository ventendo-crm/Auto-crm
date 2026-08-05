"use client";

import { Loader2, MessageSquarePlus, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";

const TOPICS = [
  { value: "question", label: "Вопрос по работе CRM" },
  { value: "bug", label: "Ошибка / баг" },
  { value: "idea", label: "Идея / улучшение" },
  { value: "other", label: "Другое" },
] as const;

type TopicValue = (typeof TOPICS)[number]["value"];

export function HelpFeedbackForm() {
  const { user } = useAuth();
  const [topic, setTopic] = useState<TopicValue>("question");
  const [message, setMessage] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api.help
      .feedbackStatus()
      .then((status) => {
        if (!cancelled) setConfigured(status.configured);
      })
      .catch(() => {
        if (!cancelled) setConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (message.trim().length < 10) {
      toast.error("Опишите подробнее — минимум 10 символов");
      return;
    }
    setSending(true);
    try {
      const result = await api.help.sendFeedback({ topic, message: message.trim() });
      toast.success(result.message);
      setMessage("");
      setTopic("question");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-2 border-b pb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand">
          <MessageSquarePlus className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Обратная связь</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Напишите разработчику Auto-CRM. Ответ придёт на{" "}
            <span className="font-medium text-foreground">{user?.email ?? "ваш email"}</span>.
          </p>
        </div>
      </div>

      {configured === false ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
          Сейчас отправка сообщений недоступна: на сервере не настроена почта. Напишите
          администратору платформы напрямую.
        </p>
      ) : (
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feedback-topic">Тема</Label>
            <Select value={topic} onValueChange={(value) => setTopic(value as TopicValue)}>
              <SelectTrigger id="feedback-topic">
                <SelectValue placeholder="Выберите тему" />
              </SelectTrigger>
              <SelectContent>
                {TOPICS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-message">Сообщение</Label>
            <Textarea
              id="feedback-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Опишите вопрос или проблему…"
              rows={7}
              maxLength={4000}
              required
            />
            <p className="text-xs text-muted-foreground">{message.trim().length}/4000</p>
          </div>

          <Button type="submit" variant="brand" disabled={sending || configured === null}>
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Отправить
          </Button>
        </form>
      )}
    </div>
  );
}
