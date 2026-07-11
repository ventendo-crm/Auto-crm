"use client";

import { Loader2, Plus, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DeleteUserDialog } from "@/components/settings/delete-user-dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { ROLE_LABELS } from "@/lib/constants";
import { User } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

function roleLabel(name: string): string {
  return ROLE_LABELS[name] ?? name;
}

export function ManagersPanel({
  canDeleteUsers = false,
  showOtherUsers = false,
}: {
  canDeleteUsers?: boolean;
  showOtherUsers?: boolean;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const usersData = await api.users.list();
      setUsers(usersData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить пользователей");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();

    setCreating(true);
    try {
      await api.users.create({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      toast.success("Менеджер добавлен");
      setDialogOpen(false);
      setForm({ name: "", email: "", password: "" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось добавить менеджера");
    } finally {
      setCreating(false);
    }
  };

  const managers = users.filter((user) => user.role.name === "MANAGER");

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Менеджеры</CardTitle>
          <CardDescription className="mt-1">
            Добавляйте менеджеров — вы будете видеть сделки друг друга, но не чужих менеджеров
          </CardDescription>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="brand" size="sm" className="shrink-0">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Добавить</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый менеджер</DialogTitle>
              <DialogDescription>
                Создайте учётную запись менеджера. Передайте ему email и пароль для входа.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="manager-name">Имя</Label>
                <Input
                  id="manager-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Иван Иванов"
                  required
                  minLength={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="manager-email">Email</Label>
                <Input
                  id="manager-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="manager@company.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="manager-password">Пароль</Label>
                <Input
                  id="manager-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Минимум 6 символов"
                  required
                  minLength={6}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" variant="brand" disabled={creating}>
                  {creating ? (
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
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : managers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Менеджеров пока нет</p>
        ) : (
          <div className="space-y-2">
            {managers.map((manager) => (
              <div
                key={manager.id}
                className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{manager.name}</p>
                    <Badge variant="outline">{roleLabel(manager.role.name)}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{manager.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Добавлен: {formatDateTime(manager.createdAt)}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                  <div className="text-sm text-muted-foreground sm:text-right">
                    <p className="font-medium text-foreground">
                      {manager._count?.deals ?? 0}
                    </p>
                    <p className="text-xs">привязанных сделок</p>
                  </div>

                  {canDeleteUsers && (
                    <DeleteUserDialog
                      userId={manager.id}
                      userName={manager.name}
                      dealsCount={manager._count?.deals ?? 0}
                      onDeleted={load}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && showOtherUsers && users.some((user) => user.role.name !== "MANAGER") && (
          <div className="rounded-lg border border-dashed p-4">
            <p className="text-sm font-medium">Другие пользователи</p>
            <div className="mt-2 space-y-2">
              {users
                .filter((user) => user.role.name !== "MANAGER")
                .map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-medium">{user.name}</span>
                      <span className="mx-2 text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{user.email}</span>
                    </div>
                    <Badge variant="secondary">{roleLabel(user.role.name)}</Badge>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
