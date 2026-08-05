export const DASHBOARD_WIDGET_IDS = [
  "arrival_calendar",
  "today_reminders",
  "recent_deals",
  "manager_stats",
  "charts",
  "stats_cards",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export interface DashboardLayoutItem {
  id: DashboardWidgetId;
  enabled: boolean;
  sortOrder: number;
}

export const DASHBOARD_WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  arrival_calendar: "Календарь прибытий",
  today_reminders: "Напоминания на сегодня",
  recent_deals: "Недавние сделки",
  manager_stats: "Статистика по менеджерам",
  charts: "Графики",
  stats_cards: "Сводные карточки",
};

/** Default order matches the previous fixed dashboard layout. */
export function getDefaultDashboardLayout(): DashboardLayoutItem[] {
  return DASHBOARD_WIDGET_IDS.map((id, index) => ({
    id,
    enabled: true,
    sortOrder: (index + 1) * 10,
  }));
}

export function isDashboardWidgetId(value: string): value is DashboardWidgetId {
  return (DASHBOARD_WIDGET_IDS as readonly string[]).includes(value);
}

export function normalizeDashboardLayout(
  value: unknown,
): DashboardLayoutItem[] {
  const defaults = getDefaultDashboardLayout();
  const byId = new Map<DashboardWidgetId, DashboardLayoutItem>();

  if (Array.isArray(value)) {
    for (const raw of value) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Partial<DashboardLayoutItem>;
      if (typeof item.id !== "string" || !isDashboardWidgetId(item.id)) continue;
      if (typeof item.enabled !== "boolean") continue;
      if (typeof item.sortOrder !== "number" || !Number.isFinite(item.sortOrder)) continue;
      byId.set(item.id, {
        id: item.id,
        enabled: item.enabled,
        sortOrder: item.sortOrder,
      });
    }
  }

  // Merge catalog: keep saved items, append new widget ids from defaults.
  for (const item of defaults) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }

  return [...byId.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );
}

export function sortDashboardLayout(items: DashboardLayoutItem[]): DashboardLayoutItem[] {
  return [...items]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
    .map((item, index) => ({
      ...item,
      sortOrder: (index + 1) * 10,
    }));
}
