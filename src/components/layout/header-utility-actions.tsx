"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Settings } from "lucide-react";
import { ThemeToggleIcon } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { canAccessHelp, getClientRoleName } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/** Помощь, тема и настройки в шапке — только на мобилке (на desktop они в sidebar). */
export function HeaderUtilityActions({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const role = getClientRoleName(user);
  const showHelp = role ? canAccessHelp(role) : false;

  const helpActive = pathname === "/help" || pathname.startsWith("/help/");
  const settingsActive = pathname === "/settings" || pathname.startsWith("/settings/");

  return (
    <div className={cn("flex items-center gap-0.5 md:hidden", className)}>
      {showHelp && (
        <Button
          variant="ghost"
          size="icon"
          className={cn("shrink-0", helpActive && "bg-brand-muted text-brand")}
          asChild
        >
          <Link href="/help" aria-label="Помощь">
            <BookOpen className="h-4 w-4" />
          </Link>
        </Button>
      )}

      <ThemeToggleIcon />

      <Button
        variant="ghost"
        size="icon"
        className={cn("shrink-0", settingsActive && "bg-brand-muted text-brand")}
        aria-label="Настройки"
        onClick={() => router.push("/settings")}
      >
        <Settings className="h-4 w-4" />
      </Button>
    </div>
  );
}
