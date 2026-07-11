"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, GripVertical, Loader2, User, UserCheck } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDealManagersLabel, getDealManagers } from "@/lib/deal-managers";
import { isDealOverdue } from "@/lib/deal-overdue";
import { useIsAndroidWebView } from "@/hooks/use-is-android-webview";
import { STAGE_LEFT_BORDER } from "@/lib/constants";
import { DealListItem } from "@/lib/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

interface DealCardProps {
  deal: DealListItem;
  canDrag?: boolean;
  compact?: boolean;
  isDragging?: boolean;
  isOverlay?: boolean;
  isSaving?: boolean;
}

export function DealCard({
  deal,
  canDrag = true,
  compact = false,
  isDragging,
  isOverlay,
  isSaving,
}: DealCardProps) {
  const isAndroidApp = useIsAndroidWebView();
  const dragFromHandleOnly = isAndroidApp;
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
  const overdue = isDealOverdue(deal);
  const managers = getDealManagers(deal);
  const managersLabel = formatDealManagersLabel(deal);
  const carLine = [deal.carBrand, deal.carModel, deal.carYear].filter(Boolean).join(" ");

  const dragHandle = canDrag ? (
    <div
      className={cn(
        "rounded p-0.5 text-muted-foreground touch-none",
        dragFromHandleOnly ? "opacity-100" : "opacity-0 transition-opacity group-hover:opacity-100",
      )}
      aria-label="Перетащить карточку"
      {...(dragFromHandleOnly && !isOverlay ? listeners : {})}
    >
      <GripVertical className="h-4 w-4" />
    </div>
  ) : null;

  const badges = (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
      {deal.clientUser && (
        <UserCheck
          className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400"
          aria-label={`Личный кабинет: ${deal.clientUser.email}`}
        />
      )}
      {overdue && (
        <Badge
          variant="outline"
          className="border-rose-200 bg-rose-50 px-1.5 text-[10px] text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
        >
          Просрочено
        </Badge>
      )}
      {deal.priority > 1 && (
        <Badge variant="brand" className="px-1.5 text-[10px]">
          P{deal.priority}
        </Badge>
      )}
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      style={isOverlay ? undefined : style}
      className={cn(
        "deal-card group relative border-l-4",
        STAGE_LEFT_BORDER[deal.currentStage],
        compact && "deal-card-compact",
        dragging && "opacity-40",
        isOverlay && "rotate-2 cursor-grabbing shadow-card-hover ring-2 ring-brand/30",
        canDrag && !isOverlay && !dragFromHandleOnly && "cursor-grab active:cursor-grabbing",
        !canDrag && "cursor-default",
        overdue && "bg-rose-50/40 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:ring-rose-900",
        isSaving && "pointer-events-none opacity-70",
      )}
      {...(canDrag && !isOverlay && !dragFromHandleOnly ? { ...attributes, ...listeners } : attributes)}
    >
      {isSaving && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
        </div>
      )}

      {compact ? (
        <>
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/deals/${deal.id}`}
              className="min-w-0 flex-1"
              onClick={(event) => dragging && event.preventDefault()}
              onPointerDown={(event) => canDrag && event.stopPropagation()}
            >
              <p className="truncate text-sm font-medium leading-tight hover:text-brand">
                {deal.clientName}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {carLine || deal.vin || "—"}
              </p>
            </Link>
            {dragHandle}
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold">{formatCurrency(deal.prepayment)}</span>
            {badges}
          </div>

          {managers.length > 0 && (
            <p
              className="mt-1 flex items-center gap-1 truncate text-[10px] text-muted-foreground"
              title={managers.length > 1 ? managersLabel : undefined}
            >
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{managersLabel}</span>
            </p>
          )}
        </>
      ) : (
        <>
          <div className="mb-2 flex items-start justify-between gap-2">
            <Link
              href={`/deals/${deal.id}`}
              className="min-w-0 flex-1"
              onClick={(event) => dragging && event.preventDefault()}
              onPointerDown={(event) => canDrag && event.stopPropagation()}
            >
              <p className="font-medium leading-tight hover:text-brand">{deal.clientName}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{carLine}</p>
            </Link>
            {dragHandle}
          </div>

          <p className="mb-2 font-mono text-[11px] tracking-wide text-muted-foreground">{deal.vin}</p>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span
              className="flex w-full min-w-0 items-start gap-1"
              title={managers.length > 1 ? managersLabel : undefined}
            >
              <User className="mt-0.5 h-3 w-3 shrink-0" />
              {managers.length > 0 ? (
                <span className="min-w-0 break-words leading-snug">
                  {managers.map((manager, index) => (
                    <span key={manager.id}>
                      {index > 0 && ", "}
                      {manager.name}
                    </span>
                  ))}
                </span>
              ) : (
                <span>—</span>
              )}
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
              <span
                className={cn(
                  "flex items-center gap-1",
                  overdue && "font-medium text-rose-600 dark:text-rose-400",
                )}
              >
                <Calendar className="h-3 w-3" />
                {formatDate(deal.expectedArrival)}
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">{formatCurrency(deal.prepayment)}</span>
            <div className="flex gap-1">
              {overdue && (
                <Badge
                  variant="outline"
                  className="border-rose-200 bg-rose-50 text-[10px] text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
                >
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
        </>
      )}
    </div>
  );
}
