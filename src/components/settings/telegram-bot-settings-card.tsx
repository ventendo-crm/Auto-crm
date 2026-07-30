"use client";

import { Loader2, Plug, Unplug } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { CompanyTelegramBotSettings } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function TelegramBotSettingsCard() {
  const [settings, setSettings] = useState<CompanyTelegramBotSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");
  const [defaultChatId, setDefaultChatId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.telegram.getBotSettings();
      setSettings(data);
      setDefaultChatId(data.defaultChatId ?? "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить настройки бота");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConnect = async () => {
    if (!token.trim()) {
      toast.error("Вставьте токен бота от BotFather");
      return;
    }

    setSaving(true);
    try {
      const updated = await api.telegram.connectBot({
        token: token.trim(),
        defaultChatId: defaultChatId.trim() || null,
      });
      setSettings(updated);
      setToken("");
      toast.success(
        updated.botUsername
          ? `Бот @${updated.botUsername} привязан`
          : "Бот привязан и webhook установлен",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось привязать бота");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setSaving(true);
    try {
      const updated = await api.telegram.disconnectBot();
      setSettings(updated);
      setToken("");
      setDefaultChatId("");
      toast.success("Бот отключён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отключить бота");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Бот компании
          {settings?.connected ? (
            <Badge variant="default">Привязан</Badge>
          ) : (
            <Badge variant="secondary">Не настроен</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Создайте бота у @BotFather, вставьте токен и Chat ID для служебных уведомлений. CRM
          проверит бота и сама поставит webhook.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {settings?.connected && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <div>
              Бот:{" "}
              <strong>
                {settings.botName}
                {settings.botUsername ? ` (@${settings.botUsername})` : ""}
              </strong>
            </div>
            {settings.tokenMasked && <div className="text-muted-foreground">Токен: {settings.tokenMasked}</div>}
            {settings.connectedAt && (
              <div className="text-muted-foreground">
                Подключён: {formatDateTime(settings.connectedAt)}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="bot-token">Токен бота</Label>
          <Input
            id="bot-token"
            type="password"
            autoComplete="off"
            placeholder={settings?.connected ? "Вставьте новый токен для перепривязки" : "123456:ABC…"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bot-chat-id">Chat ID (служебные уведомления)</Label>
          <Input
            id="bot-chat-id"
            placeholder="Например 123456789"
            value={defaultChatId}
            onChange={(e) => setDefaultChatId(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void handleConnect()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plug className="mr-2 h-4 w-4" />}
            Проверить и привязать
          </Button>
          {settings?.connected && (
            <Button variant="outline" onClick={() => void handleDisconnect()} disabled={saving}>
              <Unplug className="mr-2 h-4 w-4" />
              Отключить
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
