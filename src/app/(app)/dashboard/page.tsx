"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DashboardCharts } from "@/components/dashboard/charts";
import { ArrivalCalendar } from "@/components/dashboard/arrival-calendar";
import { ManagerStatsOverview } from "@/components/dashboard/manager-stats-overview";
import { RecentDeals } from "@/components/dashboard/recent-deals";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { Header } from "@/components/layout/header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";
import { DashboardData, User } from "@/lib/types";

const ALL_MANAGERS = "all";

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [managers, setManagers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedManagerId, setSelectedManagerId] = useState(ALL_MANAGERS);

  const isAdmin = user?.role.name === "ADMIN";

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

  const subtitle =
    selectedManagerId === ALL_MANAGERS
      ? "Обзор сделок и прибытий"
      : `Статистика менеджера: ${
          managers.find((manager) => manager.id === selectedManagerId)?.name ?? ""
        }`;

  return (
    <>
      <Header title="Дашборд" subtitle={subtitle} />
      <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
        {isAdmin && managers.length > 0 && (
          <Tabs value={selectedManagerId} onValueChange={setSelectedManagerId}>
            <div className="-mx-1 overflow-x-auto pb-1">
              <TabsList className="inline-flex h-auto w-max min-w-full justify-start gap-0.5 p-1 sm:min-w-0">
                <TabsTrigger value={ALL_MANAGERS}>Все менеджеры</TabsTrigger>
                {managers.map((manager) => (
                  <TabsTrigger key={manager.id} value={manager.id}>
                    {manager.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
        )}

        {loading ? (
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
          <>
            <ArrivalCalendar events={data.arrivalEvents} />
            <RecentDeals deals={data.recentDeals} />
            {data.managerStats && data.managerStats.length > 0 && (
              <ManagerStatsOverview managerStats={data.managerStats} />
            )}
            <DashboardCharts charts={data.charts} />
            <StatsCards stats={data.stats} />
          </>
        ) : null}
      </div>
    </>
  );
}
