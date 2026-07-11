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

const TAB_GRID_CLASS =
  "grid h-auto w-full grid-cols-3 gap-2 rounded-none border-0 bg-transparent p-0 shadow-none sm:grid-cols-4 md:grid-cols-5";

const TAB_TILE_CLASS = cn(
  "relative flex h-auto min-h-[4.5rem] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card px-2 py-2.5",
  "whitespace-normal text-center shadow-none transition-colors",
  "hover:border-brand/20 hover:bg-muted/30",
  "data-[state=active]:border-brand/40 data-[state=active]:bg-brand-muted/50 data-[state=active]:text-foreground data-[state=active]:shadow-sm",
);

const TAB_PILL_CLASS = cn(
  "relative inline-flex h-9 shrink-0 flex-row items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5",
  "shadow-none transition-colors",
  "hover:border-brand/20 hover:bg-muted/30",
  "data-[state=active]:border-brand/40 data-[state=active]:bg-brand-muted/50 data-[state=active]:text-foreground data-[state=active]:shadow-sm",
);

function TabBadge({ badge, pill }: { badge?: number; pill?: boolean }) {
  if (badge == null || badge <= 0) return null;

  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-5 min-w-5 px-1 text-[10px] font-normal",
        pill ? "static ml-0.5" : "absolute right-1 top-1",
      )}
    >
      {badge}
    </Badge>
  );
}

function renderTabTrigger(item: GroupedTabItem, variant: "tile" | "pill") {
  const Icon = item.icon;
  const isPill = variant === "pill";

  return (
    <TabsTrigger
      key={item.value}
      value={item.value}
      title={item.label}
      className={isPill ? TAB_PILL_CLASS : TAB_TILE_CLASS}
    >
      <Icon className={cn("shrink-0", isPill ? "h-4 w-4" : "h-5 w-5")} />
      <span
        className={cn(
          "font-medium leading-tight",
          isPill ? "text-xs whitespace-nowrap" : "text-[11px] sm:text-xs",
        )}
      >
        {item.label}
      </span>
      {item.badge != null && item.badge > 0 && (
        <TabBadge badge={item.badge} pill={isPill} />
      )}
    </TabsTrigger>
  );
}

export function GroupedTabsNav({ groups, className }: GroupedTabsNavProps) {
  return (
    <div className={cn(className)}>
      <div className="sticky top-0 z-20 -mx-1 border-b bg-background/95 px-1 pb-2 pt-1 backdrop-blur md:static md:border-b-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:backdrop-blur-none">
        <div className="md:hidden">
          <TabsList className="inline-flex h-auto w-full justify-start gap-1.5 overflow-x-auto rounded-none border-0 bg-transparent p-0 pb-1 shadow-none scrollbar-thin">
            {groups.map((group, groupIndex) => (
              <Fragment key={group.label}>
                {groupIndex > 0 && (
                  <span
                    className="mx-0.5 h-6 w-px shrink-0 self-center bg-border"
                    aria-hidden
                  />
                )}
                {group.items.map((item) => renderTabTrigger(item, "pill"))}
              </Fragment>
            ))}
          </TabsList>
        </div>

        <div className="hidden space-y-4 md:block">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <TabsList className={TAB_GRID_CLASS}>
                {group.items.map((item) => renderTabTrigger(item, "tile"))}
              </TabsList>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
