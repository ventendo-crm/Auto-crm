"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, Kanban, LayoutDashboard, PanelLeft, PanelLeftClose, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/kanban", label: "Канбан", icon: Kanban },
  { href: "/settings", label: "Настройки", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isOpen, isMobile, close } = useSidebar();

  if (!isOpen && !isMobile) {
    return null;
  }

  return (
    <>
      {isMobile && isOpen && (
        <button
          type="button"
          aria-label="Закрыть меню"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={close}
        />
      )}

      <aside
        className={cn(
          "flex h-full flex-col border-r bg-card transition-transform duration-200 ease-in-out",
          isMobile
            ? cn(
                "fixed inset-y-0 left-0 z-50 w-64 shadow-xl",
                isOpen ? "translate-x-0" : "-translate-x-full pointer-events-none",
              )
            : "relative w-60 shrink-0",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <Car className="h-4 w-4" />
          </div>
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
                onClick={() => {
                  if (isMobile) close();
                }}
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

        <div className="mt-auto border-t p-3">
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}

export function SidebarToggle() {
  const { toggle, isOpen } = useSidebar();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="shrink-0"
      onClick={toggle}
      aria-label={isOpen ? "Скрыть меню" : "Показать меню"}
    >
      {isOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
    </Button>
  );
}
