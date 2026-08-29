"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { canAccessCalculator, getClientRoleName } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { staffPrimaryNavItems } from "@/components/layout/staff-nav";

export function MobileTabBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const role = getClientRoleName(user);
  const showCalculator = role ? canAccessCalculator(role) : false;

  const items = staffPrimaryNavItems.filter(
    (item) => !item.calculatorOnly || showCalculator,
  );

  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto grid h-14 max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const label = item.shortLabel ?? item.label;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium leading-none transition-colors",
                active
                  ? "text-brand"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", active && "stroke-[2.5]")} />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
