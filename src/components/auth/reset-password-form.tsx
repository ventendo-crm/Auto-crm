"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppIconMark } from "@/components/brand/app-icon-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";

function ResetPasswordFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      toast.error("В ссылке нет токена сброса");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Пароли не совпадают");
      return;
    }
    if (password.length < 6) {
      toast.error("Минимум 6 символов");
      return;
    }

    setLoading(true);
    try {
      const result = await api.auth.confirmPasswordReset(token, password);
      toast.success(result.message);
      router.replace("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обновить пароль");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="space-y-4 text-sm text-muted-foreground">
        <p>Ссылка неполная или повреждена. Запросите восстановление пароля снова.</p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/forgot-password">Запросить новую ссылку</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-password">Новый пароль</Label>
        <Input
          id="new-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={6}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Повторите пароль</Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          minLength={6}
          required
        />
      </div>
      <Button type="submit" variant="brand" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Сохранить пароль
      </Button>
      <Button asChild type="button" variant="ghost" className="w-full">
        <Link href="/login">
          <ArrowLeft className="mr-2 h-4 w-4" />
          К входу
        </Link>
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#FFF8F6_0%,#F8FAFC_50%,#F0FDF4_100%)] p-4">
      <Card className="w-full max-w-md border-0 shadow-card-hover">
        <CardHeader className="space-y-4 text-center">
          <AppIconMark size={48} />
          <div>
            <CardTitle className="text-2xl">Новый пароль</CardTitle>
            <CardDescription className="mt-1">Придумайте новый пароль для входа</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <ResetPasswordFormInner />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
