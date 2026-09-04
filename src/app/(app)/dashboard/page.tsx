"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardCharts } from "@/components/dashboard/charts";
import { ArrivalCalendar } from "@/components/dashboard/arrival-calendar";
import { DashboardLayoutEditor } from "@/components/dashboard/dashboard-layout-editor";
import { ManagerStatsOverview } from "@/components/dashboard/manager-stats-overview";
import { RecentDeals } from "@/components/dashboard/recent-deals";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { TodayReminders } from "@/components/dashboard/today-reminders";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useCompanyWorkspace } from "@/hooks/use-company-workspace";
import { api } from "@/lib/api-client";
import {
  isDashboardWidgetId,
  type DashboardLayoutItem,
  type DashboardWidgetId,
} from "@/lib/dashboard/widgets";
import { canManageCompanyDashboard, getClientRoleName, ROLES } from "@/lib/permissions";
import { DashboardData, User } from "@/lib/types";

const ALL_MANAGERS = "all";

export default function DashboardPage() {
  const { user } = useAuth();
  const { settings } = useCompanyWorkspace();
  const [data, setData] = useState<DashboardData | null>(null);
  const [managers, setManagers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [layoutLoading, setLayoutLoading] = useState(true);
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [layout, setLayout] = useState<DashboardLayoutItem[]>([]);
  const [editingLayout, setEditingLayout] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState(ALL_MANAGERS);

  const role = getClientRoleName(user);
  const isAdmin = role === ROLES.ADMIN;
  const isStaff = role === ROLES.ADMIN || role === ROLES.MANAGER;
  const canEditLayout = role ? canManageCompanyDashboard(role) : false;

  const loadLayout = useCallback(async () => {
    setLayoutLoading(true);
    try {
      const result = await api.dashboard.getLayout();
      setLayout(
        result.layout
          .filter((item) => isDashboardWidgetId(item.id))
          .map((item) => ({
            id: item.id as DashboardWidgetId,
            enabled: Boolean(item.enabled),
            sortOrder: Number(item.sortOrder) || 0,
          })),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить layout дашборда");
    } finally {
      setLayoutLoading(false);
    }
  }, []);

  const load = useCallback(async (managerId: string) => {
    setLoading(true);
    try {
      const result = await api.dashboard.get(
        managerId !== ALL_MANAGERS ? managerId : undefined,
      );
      setData(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка загрузки дашборда");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLayout();
  }, [loadLayout]);

  useEffect(() => {
    if (!isAdmin) return;

    void api.users
      .list()
      .then((users) => setManagers(users.filter((item) => item.role.name === "MANAGER")))
      .catch(() => {
        // список менеджеров не критичен
      });
  }, [isAdmin]);

  useEffect(() => {
    void load(selectedManagerId);
  }, [load, selectedManagerId]);

  const enabledWidgets = useMemo(
    () =>
      [...layout]
        .filter((item) => item.enabled)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
    [layout],
  );

  const handleSaveLayout = async (next: DashboardLayoutItem[]) => {
    setLayoutSaving(true);
    try {
      const saved = await api.dashboard.saveLayout(next);
      setLayout(
        saved.layout
          .filter((item) => isDashboardWidgetId(item.id))
          .map((item) => ({
            id: item.id as DashboardWidgetId,
            enabled: Boolean(item.enabled),
            sortOrder: Number(item.sortOrder) || 0,
          })),
      );
      setEditingLayout(false);
      toast.success("Дашборд компании сохранён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить layout");
    } finally {
      setLayoutSaving(false);
    }
  };

  const renderWidget = (id: DashboardWidgetId) => {
    if (!data) return null;

    switch (id) {
      case "arrival_calendar":
        return (
          <ArrivalCalendar
            key={id}
            events={data.arrivalEvents}
            canSyncGoogleCalendar={isAdmin && settings.modules.googleCalendar}
          />
        );
      case "today_reminders":
        return isStaff ? <TodayReminders key={id} /> : null;
      case "recent_deals":
        return <RecentDeals key={id} deals={data.recentDeals} />;
      case "manager_stats":
        return data.managerStats && data.managerStats.length > 0 ? (
          <ManagerStatsOverview key={id} managerStats={data.managerStats} />
        ) : null;
      case "charts":
        return <DashboardCharts key={id} charts={data.charts} />;
      case "stats_cards":
        return <StatsCards key={id} stats={data.stats} />;
      default:
        return null;
    }
  };

  const subtitle =
    selectedManagerId === ALL_MANAGERS
      ? "Обзор сделок и таможни"
      : `Статистика менеджера: ${
          managers.find((manager) => manager.id === selectedManagerId)?.name ?? ""
        }`;

  return (
    <>
      <Header title="Дашборд" subtitle={subtitle} />
      <div className="page-content">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {isAdmin && managers.length > 0 && (
            <Tabs value={selectedManagerId} onValueChange={setSelectedManagerId} className="min-w-0 w-full md:flex-1">
              <TabsList className="flex h-auto w-full max-w-full flex-wrap justify-start gap-1 p-1 sm:inline-flex sm:w-max sm:max-w-none sm:flex-nowrap sm:gap-0.5">
                <TabsTrigger value={ALL_MANAGERS}>Все менеджеры</TabsTrigger>
                {managers.map((manager) => (
                  <TabsTrigger key={manager.id} value={manager.id}>
                    {manager.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          {canEditLayout && !editingLayout && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 self-start md:self-auto"
              disabled={layoutLoading}
              onClick={() => setEditingLayout(true)}
            >
              {layoutLoading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Settings2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Настроить
            </Button>
          )}
        </div>

        {editingLayout && (
          <DashboardLayoutEditor
            initialLayout={layout}
            saving={layoutSaving}
            onSave={(next) => void handleSaveLayout(next)}
            onCancel={() => setEditingLayout(false)}
          />
        )}

        {loading || layoutLoading ? (
          <>
            <Skeleton className="h-[28rem] rounded-xl" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-xl" />
              ))}
            </div>
          </>
        ) : data ? (
          enabledWidgets.map((item) => renderWidget(item.id))
        ) : null}
      </div>
    </>
  );
}
