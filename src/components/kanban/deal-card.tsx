"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DealStageType } from "@prisma/client";
import { Calendar, GripVertical, Loader2, User, UserCheck } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DealListItem } from "@/lib/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

interface DealCardProps {
  deal: DealListItem;
  canDrag?: boolean;
  isDragging?: boolean;
  isOverlay?: boolean;
  isSaving?: boolean;
}

export function DealCard({
  deal,
  canDrag = true,
  isDragging,
  isOverlay,
  isSaving,
}: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } =
    useSortable({
      id: deal.id,
      disabled: !canDrag || isOverlay,
      data: { type: "deal", stage: deal.currentStage, dealId: deal.id },
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragging = isDragging || isSortableDragging;

  const overdue =
    deal.expectedArrival &&
    deal.currentStage !== DealStageType.DELIVERY &&
    new Date(deal.expectedArrival) < new Date();

  return (
    <div
      ref={setNodeRef}
      style={isOverlay ? undefined : style}
      className={cn(
        "deal-card group relative",
        dragging && "opacity-40",
        isOverlay && "rotate-2 cursor-grabbing shadow-card-hover ring-2 ring-brand/30",
        canDrag && !isOverlay && "cursor-grab active:cursor-grabbing",
        !canDrag && "cursor-default",
        overdue && "border-rose-200 bg-rose-50/40 dark:border-rose-900 dark:bg-rose-950/30",
        isSaving && "pointer-events-none opacity-70",
      )}
      {...(canDrag && !isOverlay ? { ...attributes, ...listeners } : {})}
    >
      {isSaving && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
        </div>
      )}

      <div className="mb-2 flex items-start justify-between gap-2">
        <Link
          href={`/deals/${deal.id}`}
          className="min-w-0 flex-1"
          onClick={(e) => dragging && e.preventDefault()}
          onPointerDown={(e) => canDrag && e.stopPropagation()}
        >
          <p className="font-medium leading-tight hover:text-brand">{deal.clientName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[deal.carBrand, deal.carModel, deal.carYear].filter(Boolean).join(" ")}
          </p>
        </Link>

        {canDrag && (
          <div
            className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}
      </div>

      <p className="mb-2 font-mono text-[11px] tracking-wide text-muted-foreground">{deal.vin}</p>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {deal.manager?.name.split(" ")[0] ?? "—"}
        </span>
        {deal.clientUser && (
          <span
            className="flex min-w-0 max-w-full items-center gap-1 text-emerald-700 dark:text-emerald-400"
            title={`Личный кабинет: ${deal.clientUser.email}`}
          >
            <UserCheck className="h-3 w-3 shrink-0" />
            <span className="truncate">{deal.clientUser.name}</span>
          </span>
        )}
        {deal.expectedArrival && (
          <span className={cn("flex items-center gap-1", overdue && "font-medium text-rose-600 dark:text-rose-400")}>
            <Calendar className="h-3 w-3" />
            {formatDate(deal.expectedArrival)}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{formatCurrency(deal.prepayment)}</span>
        <div className="flex gap-1">
          {overdue && (
            <Badge variant="outline" className="border-rose-200 bg-rose-50 text-[10px] text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
              Просрочено
            </Badge>
          )}
          {deal.priority > 1 && (
            <Badge variant="brand" className="text-[10px]">
              P{deal.priority}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
