"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AppIconMark } from "@/components/brand/app-icon-mark";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

export function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Добро пожаловать!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#FFF8F6_0%,#F8FAFC_50%,#F0FDF4_100%)] p-4">
      <Card className="w-full max-w-md border-0 shadow-card-hover">
        <CardHeader className="space-y-4 text-center">
          <AppIconMark size={48} className="mx-auto block" />
          <div>
            <CardTitle className="text-2xl">Auto-CRM</CardTitle>
            <CardDescription className="mt-1">
              CRM для импорта автомобилей
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Логин</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Введите логин"
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" variant="brand" className="w-full" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Войти
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
