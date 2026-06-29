"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Car, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { getClientRoleName, getDefaultRouteForRole, ROLES } from "@/lib/permissions";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

    const role = getClientRoleName(user);
    if (!loading && user && role && role !== ROLES.CLIENT) {
      router.replace(getDefaultRouteForRole(role));
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!user || getClientRoleName(user) !== ROLES.CLIENT) {
    return null;
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <Car className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Auto-CRM</p>
            <p className="text-[11px] text-muted-foreground">Личный кабинет клиента</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Настройки</span>
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void logout()}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Выйти</span>
          </Button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
