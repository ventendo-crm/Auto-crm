"use client";

import { Bell, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountMenu } from "@/components/layout/account-menu";
import { SidebarToggle } from "@/components/layout/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";

interface HeaderProps {
  title: string;
  subtitle?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
}

export function Header({ title, subtitle, search, onSearchChange }: HeaderProps) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api.notifications
      .list({ read: false, limit: 1 })
      .then((data) => setUnreadCount(data.total))
      .catch(() => setUnreadCount(0));
  }, []);

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

        <AccountMenu />
      </div>
    </header>
  );
}
