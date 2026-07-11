import { DealStageType } from "@prisma/client";

type DealWithArrival = {
  expectedArrival?: string | Date | null;
  currentStage: DealStageType;
};

export function isDealOverdue(deal: DealWithArrival): boolean {
  if (!deal.expectedArrival || deal.currentStage === DealStageType.DELIVERY) {
    return false;
  }

  return new Date(deal.expectedArrival) < new Date();
}
