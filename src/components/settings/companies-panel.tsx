"use client";

import { Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { CompanyListItem } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function CompaniesPanel() {
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCompanies(await api.companies.list());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить компании");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const created = await api.companies.create({
        name: form.name,
        slug: form.slug || undefined,
        adminName: form.adminName,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
      });
      setCompanies((current) => [...current, created]);
      setForm({ name: "", slug: "", adminName: "", adminEmail: "", adminPassword: "" });
      toast.success(`Компания «${created.name}» создана`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать компанию");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Компании</CardTitle>
          <CardDescription>
            Платформенный администратор создаёт компанию и первого ADMIN. Далее админ компании
            настраивает своего Telegram-бота.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {companies.map((company) => (
            <div
              key={company.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <div>
                <div className="font-medium">{company.name}</div>
                <div className="text-muted-foreground">
                  slug: {company.slug} · пользователей: {company._count.users} · сделок:{" "}
                  {company._count.deals}
                </div>
                <div className="text-muted-foreground">
                  создана {formatDateTime(company.createdAt)}
                </div>
              </div>
              <div>
                {company.telegramBotUsername ? (
                  <Badge>@{company.telegramBotUsername}</Badge>
                ) : (
                  <Badge variant="secondary">бот не привязан</Badge>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Новая компания</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="company-name">Название</Label>
            <Input
              id="company-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="company-slug">Slug (латиница, опционально)</Label>
            <Input
              id="company-slug"
              placeholder="acme-import"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-name">Имя ADMIN</Label>
            <Input
              id="admin-name"
              value={form.adminName}
              onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email ADMIN</Label>
            <Input
              id="admin-email"
              type="email"
              value={form.adminEmail}
              onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="admin-password">Пароль ADMIN</Label>
            <Input
              id="admin-password"
              type="password"
              value={form.adminPassword}
              onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Создать компанию
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
