"use client";

import { BellRing, KeyRound, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useBrowserNotifications } from "@/hooks/use-browser-notifications";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";

export function ProfilePanel() {
  const { user, refresh } = useAuth();
  const browserPush = useBrowserNotifications();
  const [chatId, setChatId] = useState(user?.telegramChatId ?? "");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

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

  const enableBrowserPush = async () => {
    try {
      await browserPush.enable();
      toast.success("Браузерные уведомления включены");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось включить уведомления");
    }
  };

  const disableBrowserPush = async () => {
    try {
      await browserPush.disable();
      toast.success("Браузерные уведомления отключены");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отключить уведомления");
    }
  };

  const testBrowserPush = async () => {
    try {
      await browserPush.test();
      toast.success("Тестовое уведомление отправлено");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить тест");
    }
  };

  const browserPushStatus = (() => {
    if (browserPush.loading) return "Проверка…";
    if (browserPush.state === "unsupported") return "Браузер не поддерживает push-уведомления";
    if (browserPush.state === "server-off") return "На сервере не заданы VAPID ключи";
    if (browserPush.state === "denied") return "Доступ запрещён в настройках браузера";
    if (browserPush.state === "subscribed") return "Включены на этом устройстве";
    return "Не включены";
  })();

  const changePassword = async () => {
    if (!currentPassword.trim()) {
      toast.error("Введите текущий пароль");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Новый пароль — минимум 6 символов");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Пароли не совпадают");
      return;
    }

    if (currentPassword === newPassword) {
      toast.error("Новый пароль должен отличаться от текущего");
      return;
    }

    setPasswordLoading(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Пароль изменён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось изменить пароль");
    } finally {
      setPasswordLoading(false);
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
            <p className="text-sm font-medium">Смена пароля</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Для входа в систему по email и паролю
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="current-password">Текущий пароль</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">Новый пароль</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Подтверждение пароля</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <Button variant="brand" size="sm" onClick={changePassword} disabled={passwordLoading}>
            {passwordLoading ? <Loader2 className="animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Сохранить пароль
          </Button>
        </div>

        <Separator />

        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div>
            <p className="text-sm font-medium">Уведомления в браузере</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Push-уведомления о смене этапа, комментариях и других событиях — даже если вкладка
              свёрнута. Работает без Telegram.
            </p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">{browserPushStatus}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {browserPush.configured && !browserPush.subscribed && browserPush.state !== "denied" && (
              <Button
                variant="brand"
                size="sm"
                onClick={enableBrowserPush}
                disabled={browserPush.busy || browserPush.loading}
              >
                {browserPush.busy ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <BellRing className="h-4 w-4" />
                )}
                Включить
              </Button>
            )}
            {browserPush.subscribed && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={disableBrowserPush}
                  disabled={browserPush.busy}
                >
                  Отключить
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testBrowserPush}
                  disabled={browserPush.busy}
                >
                  {browserPush.busy ? <Loader2 className="animate-spin" /> : <BellRing className="h-4 w-4" />}
                  Тест
                </Button>
              </>
            )}
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
