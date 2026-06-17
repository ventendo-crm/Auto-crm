import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardManagerStat } from "@/lib/types";

export function ManagerStatsOverview({ managerStats }: { managerStats: DashboardManagerStat[] }) {
  if (managerStats.length === 0) {
    return null;
  }

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Статистика по менеджерам
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 pr-4 font-medium">Менеджер</th>
                <th className="pb-3 pr-4 font-medium">Всего сделок</th>
                <th className="pb-3 pr-4 font-medium">Завершено</th>
                <th className="pb-3 font-medium">Прибытия</th>
              </tr>
            </thead>
            <tbody>
              {managerStats.map((item) => (
                <tr key={item.managerId} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium">{item.managerName}</td>
                  <td className="py-3 pr-4 tabular-nums">{item.stats.total}</td>
                  <td className="py-3 pr-4 tabular-nums">{item.stats.completed}</td>
                  <td className="py-3 tabular-nums">{item.stats.eta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
