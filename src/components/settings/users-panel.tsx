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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";
import { ROLE_LABELS } from "@/lib/constants";
import { User } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const CREATABLE_ROLES = ["ADMIN", "MANAGER", "VIEWER"] as const;

type CreatableRole = (typeof CREATABLE_ROLES)[number];

function roleLabel(name: string): string {
  return ROLE_LABELS[name] ?? name;
}

export function UsersPanel() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "MANAGER" as CreatableRole,
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
        role: form.role,
      });
      toast.success("Пользователь добавлен");
      setDialogOpen(false);
      setForm({ name: "", email: "", password: "", role: "MANAGER" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось добавить пользователя");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Пользователи</CardTitle>
          <CardDescription className="mt-1">
            Все учётные записи системы: администраторы, менеджеры, наблюдатели и клиенты
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
              <DialogTitle>Новый пользователь</DialogTitle>
              <DialogDescription>
                Создайте учётную запись сотрудника. Клиентские аккаунты создаются из карточки сделки.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user-name">Имя</Label>
                <Input
                  id="user-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Иван Иванов"
                  required
                  minLength={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-email">Email</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="user@company.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-role">Роль</Label>
                <Select
                  value={form.role}
                  onValueChange={(role) => setForm({ ...form, role: role as CreatableRole })}
                >
                  <SelectTrigger id="user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CREATABLE_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {roleLabel(role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-password">Пароль</Label>
                <Input
                  id="user-password"
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
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пользователей пока нет</p>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{user.name}</p>
                    <Badge variant="outline">{roleLabel(user.role.name)}</Badge>
                    {user.id === currentUser?.id && (
                      <Badge variant="secondary">Вы</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{user.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Добавлен: {formatDateTime(user.createdAt)}
                  </p>
                  {user.clientDeal && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Личный кабинет: {user.clientDeal.clientName}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                  {user.role.name === "MANAGER" && (
                    <div className="text-sm text-muted-foreground sm:text-right">
                      <p className="font-medium text-foreground">
                        {user._count?.deals ?? 0}
                      </p>
                      <p className="text-xs">привязанных сделок</p>
                    </div>
                  )}

                  <DeleteUserDialog
                    userId={user.id}
                    userName={user.name}
                    dealsCount={user.role.name === "MANAGER" ? user._count?.deals ?? 0 : 0}
                    isSelf={user.id === currentUser?.id}
                    onDeleted={load}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
