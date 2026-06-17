"use client";

import { useState } from "react";
import { Car, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

export function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("alex@auto-crm.local");
  const [password, setPassword] = useState("password123");
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
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-sm">
            <Car className="h-6 w-6" />
          </div>
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
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
                required
              />
            </div>
            <Button type="submit" variant="brand" className="w-full" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Войти
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Seed: admin@crm.com / 12345678
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
