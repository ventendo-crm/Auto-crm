import { CalendarClock, Car, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardStats } from "@/lib/types";
import { cn } from "@/lib/utils";

const cards = [
  {
    key: "total" as const,
    label: "Всего сделок",
    description: "Все сделки в системе",
    icon: Car,
    accent: "from-blue-500/10 to-blue-500/5 border-blue-200/60",
    iconClass: "text-blue-600 bg-blue-100",
  },
  {
    key: "completed" as const,
    label: "Завершено",
    description: "Этап «Получение»",
    icon: CheckCircle2,
    accent: "from-emerald-500/10 to-emerald-500/5 border-emerald-200/60",
    iconClass: "text-emerald-600 bg-emerald-100",
  },
  {
    key: "eta" as const,
    label: "Прибытия",
    description: "Ожидают прибытия",
    icon: CalendarClock,
    accent: "from-amber-500/10 to-amber-500/5 border-amber-200/60",
    iconClass: "text-amber-600 bg-amber-100",
  },
];

export function StatsCards({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        const value = stats[card.key];

        return (
          <Card
            key={card.key}
            className={cn(
              "overflow-hidden border bg-gradient-to-br shadow-card",
              card.accent,
            )}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl",
                    card.iconClass,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-3xl font-bold tabular-nums tracking-tight">{value}</p>
              </div>
              <div className="mt-4">
                <p className="font-semibold">{card.label}</p>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
