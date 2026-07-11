"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer } from "@/components/dashboard/chart-container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardChartData } from "@/lib/types";

const STAGE_COLORS = ["#60A5FA", "#FB923C", "#C084FC", "#FB7185", "#34D399", "#2DD4BF"];
const STATUS_COLORS = ["#34D399", "#FB7185", "#FBBF24", "#94A3B8"];

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md">
      {label && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.name} className="text-muted-foreground">
          {entry.name}: <span className="font-medium text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

export function DashboardCharts({ charts }: { charts: DashboardChartData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Сделки по этапам</CardTitle>
          <CardDescription>Распределение по воронке</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {charts.stageBar.some((s) => s.count > 0) ? (
            <ChartContainer className="h-full w-full">
              <BarChart data={charts.stageBar} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={56} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Сделок" radius={[6, 6, 0, 0]}>
                  {charts.stageBar.map((_, i) => (
                    <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <EmptyChart />
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Статус по прибытиям</CardTitle>
          <CardDescription>Завершено · Ожидают · Без даты</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {charts.statusPie.length > 0 ? (
            <ChartContainer className="h-full w-full">
              <PieChart>
                <Pie
                  data={charts.statusPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {charts.statusPie.map((_, i) => (
                    <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend />
              </PieChart>
            </ChartContainer>
          ) : (
            <EmptyChart />
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-card lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Прибытия по неделям</CardTitle>
          <CardDescription>Количество ожидаемых прибытий</CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          {charts.etaTimeline.length > 0 ? (
            <ChartContainer className="h-full w-full">
              <BarChart data={charts.etaTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Сделок" fill="#FF7A59" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <EmptyChart message="Нет данных по прибытиям" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyChart({ message = "Нет данных" }: { message?: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
