"use client";

import { useRouter } from "next/navigation";
import { BookOpen, Building2, Check, LogOut, Moon, Settings, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { api } from "@/lib/api-client";
import { canAccessHelp, getClientRoleName } from "@/lib/permissions";
import { AuthProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AccountMenuProps {
  /** Только иконка аватара, без имени (для компактных шапок). */
  compact?: boolean;
  className?: string;
}

export function AccountMenu({ compact = false, className }: AccountMenuProps) {
  const { user, logout, switchProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [profiles, setProfiles] = useState<AuthProfile[]>([]);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const role = getClientRoleName(user);
  const showHelp = role ? canAccessHelp(role) : false;
  const isDark = theme === "dark";

  const loadProfiles = useCallback(async () => {
    try {
      setProfiles(await api.auth.listProfiles());
    } catch {
      setProfiles([]);
    }
  }, []);

  useEffect(() => {
    if (user) {
      void loadProfiles();
    }
  }, [user, loadProfiles]);

  const initials = user?.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSwitch = async (profileId: string) => {
    if (profileId === user?.id || switchingId) return;
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

  const showSwitcher = profiles.length > 1;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={cn("gap-2 px-2", className)}>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-brand-muted text-brand text-xs">{initials}</AvatarFallback>
          </Avatar>
          {!compact && (
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-none">{user?.name}</p>
              <p className="text-xs text-muted-foreground">
                {user?.company?.name ? `${user.company.name} · ` : ""}
                {user?.role.name}
              </p>
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <p>{user?.name}</p>
          <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
          {user?.company?.name && (
            <p className="mt-1 text-xs font-normal text-muted-foreground">{user.company.name}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {showSwitcher && (
          <>
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
                <Building2 className="h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{profile.company.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {profile.role.name}
                    {profile.name !== user?.name ? ` · ${profile.name}` : ""}
                  </p>
                </div>
                {profile.isCurrent && <Check className="h-4 w-4 shrink-0 text-brand" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {showHelp && (
          <DropdownMenuItem className="md:hidden" onSelect={() => router.push("/help")}>
            <BookOpen className="h-4 w-4" />
            Помощь
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          className="md:hidden"
          onSelect={(event) => {
            event.preventDefault();
            toggleTheme();
          }}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {isDark ? "Светлая тема" : "Тёмная тема"}
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => router.push("/settings")}>
          <Settings className="h-4 w-4 md:hidden" />
          Настройки
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void logout();
          }}
        >
          <LogOut className="h-4 w-4" />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
