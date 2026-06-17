import { DealStageType } from "@prisma/client";
import { DragEndEvent, DragOverEvent } from "@dnd-kit/core";
import { STAGE_ORDER } from "@/lib/constants";
import { DealListItem } from "@/lib/types";

const STAGE_SET = new Set<string>(STAGE_ORDER);

export function isStageId(id: string): id is DealStageType {
  return STAGE_SET.has(id);
}

export function resolveTargetStage(
  overId: string | undefined,
  deals: DealListItem[],
  overData?: { stage?: DealStageType; type?: string },
): DealStageType | null {
  if (!overId) return null;

  if (isStageId(overId)) {
    return overId;
  }

  if (overData?.stage) {
    return overData.stage;
  }

  const targetDeal = deals.find((deal) => deal.id === overId);
  return targetDeal?.currentStage ?? null;
}

export function resolveDragOverStage(
  event: DragOverEvent,
  deals: DealListItem[],
): DealStageType | null {
  const { over } = event;
  if (!over) return null;

  return resolveTargetStage(
    String(over.id),
    deals,
    over.data.current as { stage?: DealStageType; type?: string } | undefined,
  );
}

export function resolveDragEndStage(
  event: DragEndEvent,
  deals: DealListItem[],
): DealStageType | null {
  const { over } = event;
  if (!over) return null;

  return resolveTargetStage(
    String(over.id),
    deals,
    over.data.current as { stage?: DealStageType; type?: string } | undefined,
  );
}

export function canDragDeal(
  role: string | undefined,
  userId: string | undefined,
  managerId: string,
): boolean {
  if (!role || !userId) return false;
  if (role === "VIEWER") return false;
  if (role === "ADMIN") return true;
  if (role === "MANAGER") return userId === managerId;
  return false;
}
