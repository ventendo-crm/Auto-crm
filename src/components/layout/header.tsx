"use client";

import { Bell, Building2, Check, LogOut, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SidebarToggle } from "@/components/layout/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";
import { AuthProfile } from "@/lib/types";

interface HeaderProps {
  title: string;
  subtitle?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
}

export function Header({ title, subtitle, search, onSearchChange }: HeaderProps) {
  const { user, logout, switchProfile } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [profiles, setProfiles] = useState<AuthProfile[]>([]);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    try {
      setProfiles(await api.auth.listProfiles());
    } catch {
      setProfiles([]);
    }
  }, []);

  useEffect(() => {
    api.notifications
      .list({ read: false, limit: 1 })
      .then((data) => setUnreadCount(data.total))
      .catch(() => setUnreadCount(0));
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
    <header className="sticky top-0 z-[60] flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-card px-3 sm:gap-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <SidebarToggle />
        <div className="min-w-0">
          <h1 className="text-page-title truncate">{title}</h1>
          {subtitle && <p className="text-page-subtitle truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        {onSearchChange && (
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск по VIN, клиенту..."
              className="w-64 pl-9"
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        )}

        <Button variant="ghost" size="icon" className="relative" onClick={() => router.push("/settings")}>
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center border-0 bg-brand px-1 text-[10px] text-brand-foreground">
              {unreadCount}
            </Badge>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-brand-muted text-brand text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {user?.company?.name ? `${user.company.name} · ` : ""}
                  {user?.role.name}
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <p>{user?.name}</p>
              <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
              {user?.company?.name && (
                <p className="mt-1 text-xs font-normal text-muted-foreground">
                  {user.company.name}
                </p>
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

            <DropdownMenuItem onSelect={() => router.push("/settings")}>
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
      </div>
    </header>
  );
}
