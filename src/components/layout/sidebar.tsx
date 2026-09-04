"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Car, PanelLeft, PanelLeftClose, Settings } from "lucide-react";
import { AppLogo } from "@/components/layout/app-logo";
import { staffSidebarNavItems } from "@/components/layout/staff-nav";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useSidebar } from "@/hooks/use-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useCompanyWorkspace } from "@/hooks/use-company-workspace";
import { canAccessCalculator, canAccessCatalog, canAccessHelp, getClientRoleName, ROLES } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const clientNavItems = [
  { href: "/my-deal", label: "Моя сделка", icon: Car },
  { href: "/settings", label: "Настройки", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isOpen, isMobile } = useSidebar();
  const { user } = useAuth();
  const { settings } = useCompanyWorkspace();
  const role = getClientRoleName(user);
  const showHelp = role ? canAccessHelp(role) : false;
  const navItems =
    role === ROLES.CLIENT
      ? clientNavItems
      : staffSidebarNavItems.filter((item) => {
          if (item.calculatorOnly) {
            return role ? canAccessCalculator(role, settings.modules.calculator) : false;
          }
          if (item.catalogOnly) {
            return role ? canAccessCatalog(role, settings.modules.catalog) : false;
          }
          return true;
        });

  const helpActive = pathname === "/help" || pathname.startsWith("/help/");

  if (isMobile) {
    return null;
  }

  if (!isOpen) {
    return null;
  }

  return (
    <aside className="relative flex h-full w-60 shrink-0 flex-col border-r bg-card">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <AppLogo size={32} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Auto-CRM</p>
            <p className="truncate text-[11px] text-muted-foreground">Импорт автомобилей</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-muted text-brand"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-1 border-t p-3">
          {showHelp && (
            <Link
              href="/help"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                helpActive
                  ? "bg-brand-muted text-brand"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              Помощь
            </Link>
          )}
          <ThemeToggle />
        </div>
      </aside>
  );
}

export function SidebarToggle() {
  const { toggle, isOpen } = useSidebar();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="hidden shrink-0 md:inline-flex"
      onClick={toggle}
      aria-label={isOpen ? "Скрыть меню" : "Показать меню"}
    >
      {isOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
    </Button>
  );
}
