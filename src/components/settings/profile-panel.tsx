"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";

export function ProfilePanel() {
  const { user, refresh } = useAuth();
  const [chatId, setChatId] = useState(user?.telegramChatId ?? "");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  if (!user) return null;

  const saveTelegram = async () => {
    if (!chatId.trim()) {
      toast.error("Введите Chat ID");
      return;
    }

    setLoading(true);
    try {
      await api.auth.linkTelegram(chatId.trim());
      await refresh();
      toast.success("Telegram привязан");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка привязки");
    } finally {
      setLoading(false);
    }
  };

  const unlinkTelegram = async () => {
    setLoading(true);
    try {
      await api.auth.unlinkTelegram();
      setChatId("");
      await refresh();
      toast.success("Telegram отвязан");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const testTelegram = async () => {
    setTesting(true);
    try {
      await api.auth.testTelegram();
      toast.success("Тестовое сообщение отправлено в Telegram");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить тест");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="text-base">Профиль</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Имя</p>
            <p className="font-medium">{user.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Роль</p>
            <p className="font-medium">{user.role.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Telegram Chat ID</p>
            <p className="font-medium">{user.telegramChatId ?? "—"}</p>
          </div>
        </div>

        <Separator />

        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div>
            <p className="text-sm font-medium">Уведомления в Telegram</p>
            <p className="mt-1 text-xs text-muted-foreground">
              1. Напишите боту <code>/start</code> или <code>/link ваш@email.com</code>
              <br />
              2. Скопируйте Chat ID и сохраните ниже
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="telegram-chat-id">Chat ID</Label>
            <Input
              id="telegram-chat-id"
              placeholder="Например: 123456789"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="brand" size="sm" onClick={saveTelegram} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Send className="h-4 w-4" />}
              Привязать
            </Button>
            {user.telegramChatId && (
              <>
                <Button variant="outline" size="sm" onClick={unlinkTelegram} disabled={loading}>
                  Отвязать
                </Button>
                <Button variant="outline" size="sm" onClick={testTelegram} disabled={testing}>
                  {testing ? <Loader2 className="animate-spin" /> : <Send className="h-4 w-4" />}
                  Тест
                </Button>
              </>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Зарегистрирован: {formatDateTime(user.createdAt)}
        </p>
      </CardContent>
    </Card>
  );
}
