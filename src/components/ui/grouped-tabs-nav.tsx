"use client";

import { Badge } from "@/components/ui/badge";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface GroupedTabItem {
  value: string;
  label: string;
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
    <div className={cn("space-y-3", className)}>
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          <TabsList className="inline-flex h-auto w-full flex-wrap justify-start gap-1 p-1">
            {group.items.map((item) => (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className="gap-1.5 data-[state=active]:bg-background"
              >
                {item.label}
                {item.badge != null && item.badge > 0 && (
                  <Badge
                    variant="secondary"
                    className="h-5 min-w-5 px-1.5 text-[10px] font-normal"
                  >
                    {item.badge}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      ))}
    </div>
  );
}
