"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DealStageType } from "@prisma/client";
import { DealCard } from "@/components/kanban/deal-card";
import { STAGE_ACCENT_BG, STAGE_COLORS, STAGE_COLUMN_BG, STAGE_LABELS } from "@/lib/constants";
import { DealListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  stage: DealStageType;
  deals: DealListItem[];
  compact?: boolean;
  isOver?: boolean;
  dragEnabled?: boolean;
  canDrag: (deal: DealListItem) => boolean;
  savingDealId?: string | null;
}

export function KanbanColumn({
  stage,
  deals,
  compact = false,
  isOver,
  dragEnabled = true,
  canDrag,
  savingDealId,
}: KanbanColumnProps) {
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({
    id: stage,
    data: { type: "column", stage },
  });

  const highlighted = isOver || isDroppableOver;

  return (
    <div
      className={cn(
        "flex h-[calc(100dvh-13rem)] shrink-0 snap-center flex-col rounded-xl border border-t-4 shadow-sm transition-all duration-normal",
        compact
          ? "w-[min(78vw,14.5rem)] sm:w-56 md:w-60"
          : "w-[min(85vw,18rem)] sm:w-72 md:h-[calc(100vh-13rem)] md:w-80",
        !compact && "md:h-[calc(100vh-13rem)]",
        STAGE_COLUMN_BG[stage],
        highlighted && "scale-[1.015] shadow-card-hover ring-2 ring-brand/40",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-card/70 px-3 py-3 backdrop-blur-sm sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn("h-2.5 w-2.5 shrink-0 rounded-full", STAGE_ACCENT_BG[stage])}
            aria-hidden
          />
          <h3 className="truncate text-sm font-semibold tracking-tight">{STAGE_LABELS[stage]}</h3>
        </div>
        <span
          className={cn(
            "inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-1.5 text-xs font-semibold tabular-nums",
            STAGE_COLORS[stage],
          )}
        >
          {deals.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2.5 py-2.5 sm:px-3 sm:py-3"
      >
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          <div className={cn("min-h-[200px] flex-1", compact ? "space-y-1.5" : "space-y-2")}>
            {deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                compact={compact}
                canDrag={canDrag(deal)}
                isSaving={savingDealId === deal.id}
              />
            ))}

            {deals.length === 0 && (
              <div
                className={cn(
                  "flex min-h-[160px] items-center justify-center rounded-lg border-2 border-dashed text-center text-xs text-muted-foreground transition-colors duration-normal",
                  highlighted && "border-brand/40 bg-brand-muted/40 text-brand",
                )}
              >
                {dragEnabled ? "Перетащите карточку сюда" : "Сделок пока нет"}
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
