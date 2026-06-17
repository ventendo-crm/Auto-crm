import { DealStageType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/constants";
import { AuthUser, ROLES } from "@/lib/permissions";
import { DashboardChartData, DashboardData, DashboardManagerStat, DashboardStats } from "@/lib/types";

function buildDealWhere(user: AuthUser, managerId?: string): Prisma.DealWhereInput {
  if (user.role === ROLES.MANAGER) {
    return { managerId: user.id };
  }

  if (managerId) {
    return { managerId };
  }

  return {};
}

type DealRow = {
  id: string;
  clientName: string;
  currentStage: DealStageType;
  expectedArrival: Date | null;
  stageEnteredAt: Date;
  createdAt: Date;
  updatedAt: Date;
  prepayment: Prisma.Decimal | null;
  carBrand: string | null;
  carModel: string | null;
  vin: string;
  manager: { id: string; name: string };
};

function computeStats(deals: DealRow[]): DashboardStats {
  const now = new Date();

  const completed = deals.filter((d) => d.currentStage === DealStageType.DELIVERY).length;

  const eta = deals.filter((d) => {
    if (d.currentStage === DealStageType.DELIVERY) return false;
    if (!d.expectedArrival) return false;
    return d.expectedArrival >= now;
  }).length;

  return {
    total: deals.length,
    completed,
    eta,
  };
}

function computeCharts(deals: DealRow[]): DashboardChartData {
  const now = new Date();

  const byStage = STAGE_ORDER.map((stage) => ({
    stage,
    name: STAGE_LABELS[stage],
    value: deals.filter((d) => d.currentStage === stage).length,
  }));

  const etaDeals = deals
    .filter((d) => {
      if (d.currentStage === DealStageType.DELIVERY || !d.expectedArrival) return false;
      return d.expectedArrival >= now;
    })
    .sort((a, b) => a.expectedArrival!.getTime() - b.expectedArrival!.getTime())
    .slice(0, 10)
    .map((d) => ({
      dealId: d.id,
      name: d.clientName.split(" ")[0],
      clientName: d.clientName,
      days: Math.ceil((d.expectedArrival!.getTime() - now.getTime()) / 86400000),
      date: d.expectedArrival!.toISOString(),
    }));

  const weekMap = new Map<string, number>();
  for (const deal of deals) {
    if (deal.currentStage === DealStageType.DELIVERY || !deal.expectedArrival) continue;
    if (deal.expectedArrival < now) continue;

    const weekStart = new Date(deal.expectedArrival);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const key = weekStart.toISOString().slice(0, 10);

    weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
  }

  const etaTimeline = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 8)
    .map(([week, count]) => ({
      week,
      label: new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(
        new Date(week),
      ),
      count,
    }));

  const stageBar = byStage.map((item) => ({
    name: item.name,
    count: item.value,
  }));

  const statusPie = [
    { name: "Завершено", value: deals.filter((d) => d.currentStage === DealStageType.DELIVERY).length },
    {
      name: "Прибытия",
      value: deals.filter((d) => {
        if (d.currentStage === DealStageType.DELIVERY || !d.expectedArrival) return false;
        return d.expectedArrival >= now;
      }).length,
    },
    {
      name: "Без даты прибытия",
      value: deals.filter(
        (d) => d.currentStage !== DealStageType.DELIVERY && !d.expectedArrival,
      ).length,
    },
  ].filter((item) => item.value > 0);

  return { byStage, etaDeals, etaTimeline, stageBar, statusPie };
}

function computeManagerStats(deals: DealRow[]): DashboardManagerStat[] {
  const grouped = new Map<string, { managerName: string; deals: DealRow[] }>();

  for (const deal of deals) {
    const current = grouped.get(deal.manager.id) ?? {
      managerName: deal.manager.name,
      deals: [],
    };
    current.deals.push(deal);
    grouped.set(deal.manager.id, current);
  }

  return Array.from(grouped.entries())
    .map(([managerId, { managerName, deals: managerDeals }]) => ({
      managerId,
      managerName,
      stats: computeStats(managerDeals),
    }))
    .sort((a, b) => b.stats.total - a.stats.total || a.managerName.localeCompare(b.managerName, "ru"));
}

export async function getDashboardData(
  user: AuthUser,
  managerId?: string,
): Promise<DashboardData> {
  if (user.role === ROLES.CLIENT) {
    throw new Error("Forbidden");
  }

  const effectiveManagerId = user.role === ROLES.ADMIN ? managerId : undefined;

  const deals = await prisma.deal.findMany({
    where: buildDealWhere(user, effectiveManagerId),
    select: {
      id: true,
      clientName: true,
      currentStage: true,
      expectedArrival: true,
      stageEnteredAt: true,
      createdAt: true,
      updatedAt: true,
      prepayment: true,
      carBrand: true,
      carModel: true,
      vin: true,
      manager: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const stats = computeStats(deals);
  const charts = computeCharts(deals);

  const recentDeals = deals.slice(0, 8).map((d) => ({
    id: d.id,
    clientName: d.clientName,
    vin: d.vin,
    carBrand: d.carBrand,
    carModel: d.carModel,
    currentStage: d.currentStage,
    expectedArrival: d.expectedArrival?.toISOString() ?? null,
    prepayment: d.prepayment ? Number(d.prepayment) : null,
    updatedAt: d.updatedAt.toISOString(),
    manager: d.manager,
  }));

  const managerStats =
    user.role === ROLES.ADMIN && !effectiveManagerId
      ? computeManagerStats(deals)
      : undefined;

  return { stats, charts, recentDeals, managerStats };
}
