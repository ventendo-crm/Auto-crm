"use client";

import { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface GroupedTabItem {
  value: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export interface GroupedTabGroup {
  label: string;
  items: GroupedTabItem[];
}

interface GroupedTabsNavProps {
  groups: GroupedTabGroup[];
  className?: string;
}

export function GroupedTabsNav({ groups, className }: GroupedTabsNavProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          <TabsList
            className={cn(
              "grid h-auto w-full gap-2 rounded-none border-0 bg-transparent p-0 shadow-none",
              group.items.length <= 3
                ? "grid-cols-3"
                : group.items.length === 4
                  ? "grid-cols-2 sm:grid-cols-4"
                  : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
            )}
          >
            {group.items.map((item) => {
              const Icon = item.icon;

              return (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  title={item.label}
                  className={cn(
                    "relative flex h-auto min-h-[4.5rem] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card px-2 py-2.5",
                    "whitespace-normal text-center shadow-none transition-colors",
                    "hover:border-brand/20 hover:bg-muted/30",
                    "data-[state=active]:border-brand/40 data-[state=active]:bg-brand-muted/50 data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-[11px] font-medium leading-tight sm:text-xs">
                    {item.label}
                  </span>
                  {item.badge != null && item.badge > 0 && (
                    <Badge
                      variant="secondary"
                      className="absolute right-1 top-1 h-5 min-w-5 px-1 text-[10px] font-normal"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
      ))}
    </div>
  );
}
