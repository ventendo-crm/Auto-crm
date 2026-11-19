"use client";

import { BellRing, KeyRound, Loader2, Mail, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useBrowserNotifications } from "@/hooks/use-browser-notifications";
import { api } from "@/lib/api-client";
import { getClientRoleName } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";

export function ProfilePanel() {
  const { user, refresh } = useAuth();
  const browserPush = useBrowserNotifications();
  const [chatId, setChatId] = useState(user?.telegramChatId ?? "");
  const [maxUserId, setMaxUserId] = useState(user?.maxUserId ?? "");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [maxLoading, setMaxLoading] = useState(false);
  const [maxTesting, setMaxTesting] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);

  const role = getClientRoleName(user);
  const isClient = role === "CLIENT";
  const canTestEmail = role === "CLIENT" || role === "ADMIN" || role === "MANAGER";

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setChatId(user?.telegramChatId ?? "");
  }, [user?.telegramChatId]);

  useEffect(() => {
    setMaxUserId(user?.maxUserId ?? "");
  }, [user?.maxUserId]);

  useEffect(() => {
    if (!canTestEmail) return;

    void api.email
      .status()
      .then((status) => setEmailConfigured(status.configured))
      .catch(() => setEmailConfigured(false));
  }, [canTestEmail]);

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

  const saveMax = async () => {
    if (!maxUserId.trim()) {
      toast.error("Введите ID из MAX");
      return;
    }
    setMaxLoading(true);
    try {
      await api.auth.linkMax(maxUserId.trim());
      await refresh();
      toast.success("MAX привязан");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка привязки MAX");
    } finally {
      setMaxLoading(false);
    }
  };

  const unlinkMax = async () => {
    setMaxLoading(true);
    try {
      await api.auth.unlinkMax();
      setMaxUserId("");
      await refresh();
      toast.success("MAX отвязан");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setMaxLoading(false);
    }
  };

  const testMax = async () => {
    setMaxTesting(true);
    try {
      await api.auth.testMax();
      toast.success("Тестовое сообщение отправлено в MAX");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить тест");
    } finally {
      setMaxTesting(false);
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

  const testEmail = async () => {
    setEmailTesting(true);
    try {
      const result = await api.email.test();
      toast.success(`Тестовое письмо отправлено на ${result.to}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить письмо");
    } finally {
      setEmailTesting(false);
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
          <div>
            <p className="text-xs text-muted-foreground">MAX ID</p>
            <p className="font-medium">{user.maxUserId ?? "—"}</p>
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

        <Separator />

        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div>
            <p className="text-sm font-medium">Уведомления в MAX</p>
            <p className="mt-1 text-xs text-muted-foreground">
              1. Напишите боту компании в MAX <code>/start</code> или{" "}
              <code>/link ваш@email.com</code>
              <br />
              2. Скопируйте ID и сохраните ниже
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-user-id">ID в MAX</Label>
            <Input
              id="max-user-id"
              placeholder="Например: 123456789"
              value={maxUserId}
              onChange={(e) => setMaxUserId(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="brand" size="sm" onClick={() => void saveMax()} disabled={maxLoading}>
              {maxLoading ? <Loader2 className="animate-spin" /> : <Send className="h-4 w-4" />}
              Привязать
            </Button>
            {user.maxUserId && (
              <>
                <Button variant="outline" size="sm" onClick={() => void unlinkMax()} disabled={maxLoading}>
                  Отвязать
                </Button>
                <Button variant="outline" size="sm" onClick={() => void testMax()} disabled={maxTesting}>
                  {maxTesting ? <Loader2 className="animate-spin" /> : <Send className="h-4 w-4" />}
                  Тест
                </Button>
              </>
            )}
          </div>
        </div>

        {canTestEmail && (
          <>
            <Separator />
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium">
                  {isClient ? "Уведомления на email" : "Почта сервера (SMTP)"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isClient ? (
                    <>
                      На адрес <span className="font-medium text-foreground">{user.email}</span>{" "}
                      приходят письма о смене этапа сделки и комментариях менеджера.
                    </>
                  ) : (
                    <>
                      Проверка отправки через SMTP. Тестовое письмо уйдёт на{" "}
                      <span className="font-medium text-foreground">{user.email}</span>.
                    </>
                  )}
                </p>
              </div>

              {emailConfigured ? (
                <Button variant="outline" size="sm" onClick={testEmail} disabled={emailTesting}>
                  {emailTesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  Отправить тест
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Почтовый сервер на стороне CRM пока не настроен — письма не отправляются.
                </p>
              )}
            </div>
          </>
        )}

        <p className="text-xs text-muted-foreground">
          Зарегистрирован: {formatDateTime(user.createdAt)}
        </p>
      </CardContent>
    </Card>
  );
}
