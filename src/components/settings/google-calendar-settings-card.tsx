"use client";

import { CalendarDays, Loader2, Plug, RefreshCw, Unplug } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { CompanyGoogleCalendarSettings } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function GoogleCalendarSettingsCard() {
  const [settings, setSettings] = useState<CompanyGoogleCalendarSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.googleCalendar.getSettings();
      setSettings(data);
      if (data.googleEmail) {
        setGoogleEmail(data.googleEmail);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить настройки календаря");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConnect = async () => {
    if (!googleEmail.trim()) {
      toast.error("Укажите Google-аккаунт, в который выгружать события");
      return;
    }

    setSaving(true);
    try {
      const { url } = await api.googleCalendar.connect({ googleEmail: googleEmail.trim() });
      window.location.assign(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось начать подключение Google");
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setSaving(true);
    try {
      const updated = await api.googleCalendar.disconnect();
      setSettings(updated);
      setGoogleEmail("");
      toast.success("Google Календарь отключён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отключить календарь");
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const updated = await api.googleCalendar.syncNow();
      setSettings(updated);
      toast.success("События выгружены в Google Календарь");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось синхронизировать");
      await load();
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-48 w-full" />;
  }

  const configured = settings?.configured ?? false;
  const connected = Boolean(settings?.connected);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4" />
          Google Календарь
          {connected ? (
            <Badge variant="default">Подключён</Badge>
          ) : (
            <Badge variant="secondary">Не подключён</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Администратор указывает Google-аккаунт компании. Туда выгружаются даты таможни из
          календаря прибытий и напоминания по сделкам. События появляются в календаре ImportCRM
          этого аккаунта.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!configured && (
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            На сервере не заданы GOOGLE_CALENDAR_CLIENT_ID и GOOGLE_CALENDAR_CLIENT_SECRET.
            После настройки переменных перезапустите приложение.
          </p>
        )}

        {connected && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <div>
              Аккаунт: <strong>{settings?.googleEmail}</strong>
            </div>
            {settings?.connectedAt && (
              <div className="text-muted-foreground">
                Подключён: {formatDateTime(settings.connectedAt)}
              </div>
            )}
            {settings?.lastSyncAt && (
              <div className="text-muted-foreground">
                Последняя выгрузка: {formatDateTime(settings.lastSyncAt)}
              </div>
            )}
            {settings?.lastSyncError && (
              <div className="text-destructive">Ошибка: {settings.lastSyncError}</div>
            )}
            <div className="mt-1 text-muted-foreground">
              Чтобы сменить аккаунт, отключите календарь и подключите другой email.
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="google-calendar-email">Google-аккаунт для выгрузки</Label>
          <Input
            id="google-calendar-email"
            type="email"
            autoComplete="off"
            placeholder="office@gmail.com"
            value={googleEmail}
            onChange={(e) => setGoogleEmail(e.target.value)}
            disabled={!configured || connected || saving}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void handleConnect()} disabled={!configured || connected || saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plug className="mr-2 h-4 w-4" />
            )}
            Подключить
          </Button>
          {connected && (
            <>
              <Button variant="outline" onClick={() => void handleSync()} disabled={saving || syncing}>
                {syncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Синхронизировать сейчас
              </Button>
              <Button variant="outline" onClick={() => void handleDisconnect()} disabled={saving || syncing}>
                <Unplug className="mr-2 h-4 w-4" />
                Отключить
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
