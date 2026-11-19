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
import { CompanyMaxBotSettings } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function MaxBotSettingsCard() {
  const [settings, setSettings] = useState<CompanyMaxBotSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.max.getBotSettings();
      setSettings(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить настройки MAX");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConnect = async () => {
    if (!token.trim()) {
      toast.error("Вставьте токен бота из @MasterBot");
      return;
    }

    setSaving(true);
    try {
      const updated = await api.max.connectBot({ token: token.trim() });
      setSettings(updated);
      setToken("");
      toast.success(
        updated.botUsername
          ? `Бот @${updated.botUsername} привязан`
          : "Бот MAX привязан и webhook установлен",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось привязать бота MAX");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setSaving(true);
    try {
      const updated = await api.max.disconnectBot();
      setSettings(updated);
      setToken("");
      toast.success("Бот MAX отключён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отключить бота MAX");
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
          Бот MAX
          {settings?.connected ? (
            <Badge variant="default">Привязан</Badge>
          ) : (
            <Badge variant="secondary">Не настроен</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Создайте бота у @MasterBot в MAX, вставьте токен. CRM проверит бота и сама поставит
          webhook. Токен в чат с разработчиком не отправляйте.
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
          <Label htmlFor="max-bot-token">Токен бота MAX</Label>
          <Input
            id="max-bot-token"
            type="password"
            autoComplete="off"
            placeholder={settings?.connected ? "Вставьте новый токен для перепривязки" : "Токен из @MasterBot"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
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
