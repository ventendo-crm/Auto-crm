"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DealStageType } from "@prisma/client";
import { DealCard } from "@/components/kanban/deal-card";
import { Badge } from "@/components/ui/badge";
import { STAGE_COLUMN_BG, STAGE_LABELS } from "@/lib/constants";
import { DealListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  stage: DealStageType;
  deals: DealListItem[];
  isOver?: boolean;
  canDrag: (deal: DealListItem) => boolean;
  savingDealId?: string | null;
}

export function KanbanColumn({ stage, deals, isOver, canDrag, savingDealId }: KanbanColumnProps) {
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({
    id: stage,
    data: { type: "column", stage },
  });

  const highlighted = isOver || isDroppableOver;

  return (
    <div
      className={cn(
        "flex h-[calc(100dvh-11rem)] w-[min(85vw,18rem)] shrink-0 snap-center flex-col rounded-xl border border-t-4 bg-muted/20 shadow-sm transition-all sm:w-72 md:h-[calc(100vh-12rem)] md:w-80",
        STAGE_COLUMN_BG[stage],
        highlighted && "scale-[1.01] ring-2 ring-brand/50 shadow-card-hover",
      )}
    >
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">{STAGE_LABELS[stage]}</h3>
        <Badge variant="secondary" className="tabular-nums">
          {deals.length}
        </Badge>
      </div>

      <div
        ref={setNodeRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3"
      >
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          <div className="min-h-[200px] flex-1 space-y-2">
            {deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                canDrag={canDrag(deal)}
                isSaving={savingDealId === deal.id}
              />
            ))}

            {deals.length === 0 && (
              <div
                className={cn(
                  "flex min-h-[160px] items-center justify-center rounded-lg border-2 border-dashed text-center text-xs text-muted-foreground transition-colors",
                  highlighted && "border-brand/40 bg-brand-muted/30 text-brand",
                )}
              >
                Перетащите карточку сюда
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
