import { DealStageType } from "@prisma/client";
import { STAGE_ORDER } from "@/lib/constants";
import { DealListItem, DashboardStats } from "@/lib/types";

/** Client-side fallback when API недоступен */
export function computeDashboardStats(deals: DealListItem[]): DashboardStats {
  const now = new Date();

  return {
    total: deals.length,
    completed: deals.filter((d) => d.currentStage === DealStageType.DELIVERY).length,
    eta: deals.filter((d) => {
      if (d.currentStage === DealStageType.DELIVERY || !d.expectedArrival) return false;
      return new Date(d.expectedArrival) >= now;
    }).length,
  };
}

export function groupDealsByStage(deals: DealListItem[]) {
  return STAGE_ORDER.map((stage) => ({
    stage,
    count: deals.filter((d) => d.currentStage === stage).length,
  }));
}
