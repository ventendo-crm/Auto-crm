"use client";

import { Fragment } from "react";
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

const TAB_PILL_CLASS = cn(
  "relative inline-flex h-9 shrink-0 flex-row items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5",
  "shadow-none transition-colors",
  "hover:border-brand/20 hover:bg-muted/30",
  "data-[state=active]:border-brand/40 data-[state=active]:bg-brand-muted/50 data-[state=active]:text-foreground data-[state=active]:shadow-sm",
);

function TabBadge({ badge }: { badge?: number }) {
  if (badge == null || badge <= 0) return null;

  return (
    <Badge variant="secondary" className="static ml-0.5 h-5 min-w-5 px-1 text-[10px] font-normal">
      {badge}
    </Badge>
  );
}

function renderTabTrigger(item: GroupedTabItem) {
  const Icon = item.icon;

  return (
    <TabsTrigger
      key={item.value}
      value={item.value}
      title={item.label}
      className={TAB_PILL_CLASS}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="text-xs font-medium leading-tight whitespace-nowrap">{item.label}</span>
      {item.badge != null && item.badge > 0 && <TabBadge badge={item.badge} />}
    </TabsTrigger>
  );
}

export function GroupedTabsNav({ groups, className }: GroupedTabsNavProps) {
  return (
    <div className={cn(className)}>
      <div className="sticky top-0 z-20 -mx-1 border-b bg-background/95 px-1 pb-2 pt-1 backdrop-blur md:static md:border-b-0 md:bg-transparent md:px-0 md:pb-2 md:pt-0 md:backdrop-blur-none">
        <TabsList
          className={cn(
            "inline-flex h-auto w-full justify-start gap-1.5 rounded-none border-0 bg-transparent p-0 pb-1 shadow-none",
            "flex-nowrap overflow-x-auto scrollbar-thin",
            "md:flex-wrap md:overflow-x-visible",
          )}
        >
          {groups.map((group, groupIndex) => (
            <Fragment key={group.label}>
              {groupIndex > 0 && (
                <span
                  className="mx-0.5 h-6 w-px shrink-0 self-center bg-border"
                  aria-hidden
                />
              )}
              {group.items.map((item) => renderTabTrigger(item))}
            </Fragment>
          ))}
        </TabsList>
      </div>
    </div>
  );
}
