"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, LogOut, Settings } from "lucide-react";
import { toast } from "sonner";
import { AppLogo } from "@/components/layout/app-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";
import { getClientRoleName, getDefaultRouteForRole, ROLES } from "@/lib/permissions";
import { AuthProfile } from "@/lib/types";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, switchProfile } = useAuth();
  const router = useRouter();
  const [profiles, setProfiles] = useState<AuthProfile[]>([]);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

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

  const loadProfiles = useCallback(async () => {
    try {
      setProfiles(await api.auth.listProfiles());
    } catch {
      setProfiles([]);
    }
  }, []);

  useEffect(() => {
    if (user && getClientRoleName(user) === ROLES.CLIENT) {
      void loadProfiles();
    }
  }, [user, loadProfiles]);

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

  const showSwitcher = profiles.length > 1;

  const handleSwitch = async (profileId: string) => {
    if (profileId === user.id || switchingId) return;
    setSwitchingId(profileId);
    try {
      await switchProfile(profileId);
      toast.success("Профиль переключён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось переключить профиль");
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <AppLogo size={32} />
          <div>
            <p className="text-sm font-semibold">Auto-CRM</p>
            <p className="text-[11px] text-muted-foreground">
              {user.company?.name ? `${user.company.name} · ` : ""}
              Личный кабинет
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {showSwitcher && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline max-w-[10rem] truncate">
                    {user.company?.name ?? "Профиль"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Профили
                </DropdownMenuLabel>
                {profiles.map((profile) => (
                  <DropdownMenuItem
                    key={profile.id}
                    disabled={Boolean(switchingId) || profile.isCurrent}
                    onSelect={(event) => {
                      event.preventDefault();
                      void handleSwitch(profile.id);
                    }}
                    className="gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{profile.company.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{profile.role.name}</p>
                    </div>
                    {profile.isCurrent && <Check className="h-4 w-4 shrink-0 text-brand" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Настройки</span>
            </Link>
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => void logout()}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Выйти</span>
          </Button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
