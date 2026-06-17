"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      onClick={toggleTheme}
      aria-label={isDark ? "Включить светлую тему" : "Включить тёмную тему"}
    >
      {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
      {isDark ? "Светлая тема" : "Тёмная тема"}
    </Button>
  );
}
