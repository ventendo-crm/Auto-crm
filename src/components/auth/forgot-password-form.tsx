"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppIconMark } from "@/components/brand/app-icon-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiRequestError } from "@/lib/api-client";

type CompanyOption = { slug: string; name: string };

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await api.auth.requestPasswordReset(
        email.trim(),
        companySlug.trim() || undefined,
      );
      setSent(true);
      setCompanies([]);
      toast.success(result.message);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        const data = err.data as { companies?: CompanyOption[] } | undefined;
        const list = data?.companies ?? [];
        setCompanies(list);
        if (list.length === 1) {
          setCompanySlug(list[0].slug);
        }
        toast.error(err.message);
      } else {
        toast.error(err instanceof Error ? err.message : "Не удалось отправить письмо");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#FFF8F6_0%,#F8FAFC_50%,#F0FDF4_100%)] p-4">
      <Card className="w-full max-w-md border-0 shadow-card-hover">
        <CardHeader className="space-y-4 text-center">
          <AppIconMark size={48} />
          <div>
            <CardTitle className="text-2xl">Восстановление пароля</CardTitle>
            <CardDescription className="mt-1">
              Укажите email аккаунта — пришлём ссылку для сброса
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                Если аккаунт найден, письмо уже отправлено. Проверьте почту и перейдите по ссылке
                (действует 1 час).
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  К входу
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@company.ru"
                  autoComplete="email"
                  required
                />
              </div>

              {(companies.length > 0 || companySlug) && (
                <div className="space-y-2">
                  <Label htmlFor="reset-company">Компания (slug)</Label>
                  {companies.length > 0 ? (
                    <select
                      id="reset-company"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={companySlug}
                      onChange={(event) => setCompanySlug(event.target.value)}
                      required
                    >
                      <option value="">Выберите компанию</option>
                      {companies.map((company) => (
                        <option key={company.slug} value={company.slug}>
                          {company.name} ({company.slug})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id="reset-company"
                      value={companySlug}
                      onChange={(event) => setCompanySlug(event.target.value)}
                      placeholder="acme-import"
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Нужен, если один email используется в нескольких компаниях.
                  </p>
                </div>
              )}

              <Button type="submit" variant="brand" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Отправить ссылку
              </Button>

              <Button asChild type="button" variant="ghost" className="w-full">
                <Link href="/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Назад ко входу
                </Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
