"use client";

import { Check, Copy, Loader2, RefreshCw, Send, Unlink, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { DealDetail } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

interface DealClientAccountProps {
  deal: DealDetail;
  canManage?: boolean;
  onUpdated?: () => void;
}

interface TelegramInvite {
  inviteUrl: string;
  botUsername: string;
  telegramLinked: boolean;
  expiresAt: string;
}

export function DealClientAccount({ deal, canManage = false, onUpdated }: DealClientAccountProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [invite, setInvite] = useState<TelegramInvite | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    name: deal.clientName,
    email: deal.email ?? "",
    password: "",
  });

  const loadInvite = useCallback(async () => {
    if (!deal.clientUser || !canManage) return;
    setInviteLoading(true);
    setInviteError(null);
    try {
      setInvite(await api.deals.getTelegramInvite(deal.id));
    } catch (err) {
      setInvite(null);
      setInviteError(err instanceof Error ? err.message : "Не удалось получить ссылку");
    } finally {
      setInviteLoading(false);
    }
  }, [canManage, deal.clientUser, deal.id]);

  useEffect(() => {
    void loadInvite();
  }, [loadInvite]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await api.deals.createClientAccount(deal.id, {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      toast.success("Личный кабинет клиента создан");
      if (result.telegramInvite) {
        setInvite(result.telegramInvite);
        try {
          await navigator.clipboard.writeText(result.telegramInvite.inviteUrl);
          toast.success("Ссылка Telegram скопирована");
        } catch {
          // clipboard may be blocked
        }
      }
      setOpen(false);
      setForm((current) => ({ ...current, password: "" }));
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать кабинет");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm("Отвязать личный кабинет клиента? Учётная запись будет удалена.")) {
      return;
    }

    setUnlinking(true);
    try {
      await api.deals.unlinkClientAccount(deal.id);
      toast.success("Личный кабинет отвязан");
      setInvite(null);
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отвязать кабинет");
    } finally {
      setUnlinking(false);
    }
  };

  const handleCopy = async () => {
    if (!invite?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(invite.inviteUrl);
      setCopied(true);
      toast.success("Ссылка скопирована");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Не удалось скопировать ссылку");
    }
  };

  const handleRefreshInvite = async () => {
    setInviteLoading(true);
    setInviteError(null);
    try {
      setInvite(await api.deals.refreshTelegramInvite(deal.id));
      toast.success("Новая ссылка создана");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Не удалось обновить ссылку");
    } finally {
      setInviteLoading(false);
    }
  };

  const telegramLinked = Boolean(deal.clientUser?.telegramChatId || invite?.telegramLinked);

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="text-base">Личный кабинет клиента</CardTitle>
        <CardDescription>
          Клиент сможет войти и видеть только свою карточку сделки
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {deal.clientUser ? (
          <div className="rounded-lg border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{deal.clientUser.name}</p>
                  <Badge
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                  >
                    Кабинет создан
                  </Badge>
                  {telegramLinked ? (
                    <Badge variant="brand">Telegram привязан</Badge>
                  ) : (
                    <Badge variant="secondary">Telegram не привязан</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{deal.clientUser.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Создан: {formatDateTime(deal.clientUser.createdAt)}
                </p>
              </div>

              {canManage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  disabled={unlinking}
                  onClick={() => void handleUnlink()}
                >
                  {unlinking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Unlink className="h-4 w-4" />
                  )}
                  Отвязать
                </Button>
              )}
            </div>

            {canManage && (
              <div className="mt-4 space-y-2 rounded-md border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Send className="h-4 w-4" />
                  Приглашение в Telegram
                </div>
                <p className="text-xs text-muted-foreground">
                  Отправьте клиенту ссылку. Он нажмёт Start — и уведомления по этой сделке
                  включатся автоматически.
                </p>

                {inviteLoading && !invite ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Готовим ссылку…
                  </div>
                ) : invite ? (
                  <>
                    <Input readOnly value={invite.inviteUrl} className="font-mono text-xs" />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="brand" onClick={() => void handleCopy()}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        Копировать
                      </Button>
                      <Button type="button" size="sm" variant="outline" asChild>
                        <a href={invite.inviteUrl} target="_blank" rel="noreferrer">
                          Открыть
                        </a>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={inviteLoading}
                        onClick={() => void handleRefreshInvite()}
                      >
                        {inviteLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        Новая ссылка
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Действует до {formatDateTime(invite.expiresAt)} · @{invite.botUsername}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {inviteError ?? "Не удалось получить ссылку"}
                  </p>
                )}
              </div>
            )}

            <p className="mt-3 text-xs text-muted-foreground">
              Клиент входит на странице входа и попадает в личный кабинет `/my-deal`.
            </p>
          </div>
        ) : canManage ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="brand" size="sm">
                <UserPlus className="h-4 w-4" />
                Создать кабинет клиента
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Личный кабинет клиента</DialogTitle>
                <DialogDescription>
                  Укажите данные для входа. После создания появится ссылка для Telegram.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client-account-name">Имя</Label>
                  <Input
                    id="client-account-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client-account-email">Email для входа</Label>
                  <Input
                    id="client-account-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client-account-password">Пароль</Label>
                  <Input
                    id="client-account-password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    minLength={6}
                    required
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" variant="brand" disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    Создать
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        ) : (
          <p className="text-sm text-muted-foreground">Личный кабинет клиента не привязан</p>
        )}
      </CardContent>
    </Card>
  );
}
