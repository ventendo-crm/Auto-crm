"use client";

import { useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import Link from "next/link";
import { DeleteDealDialog } from "@/components/deals/delete-deal-dialog";
import { SidebarToggle } from "@/components/layout/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDealManagersLabel } from "@/lib/deal-managers";
import { STAGE_COLORS, STAGE_LABELS } from "@/lib/constants";
import { DealDetail } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

interface DealHeaderProps {
  deal: DealDetail;
  canDelete?: boolean;
}

function formatCarLine(deal: DealDetail): string {
  const car = [deal.carBrand, deal.carModel].filter(Boolean).join(" ");
  const year = deal.carYear ? ` · ${deal.carYear}` : "";
  const city = deal.destinationCity ? ` · ${deal.destinationCity}` : "";
  return `${car}${year}${city}`.trim() || "—";
}

export function DealHeader({ deal, canDelete }: DealHeaderProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const carLine = formatCarLine(deal);
  const managersLabel = formatDealManagersLabel(deal);

  return (
    <div className="sticky top-0 z-[60] border-b bg-card px-3 py-2 sm:px-6 sm:py-5">
      <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3 sm:gap-3">
        <div className="flex items-center gap-0.5 sm:gap-1">
          <SidebarToggle />
          <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-muted-foreground sm:h-9 sm:px-3">
            <Link href="/kanban">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Канбан</span>
            </Link>
          </Button>
        </div>

        <DeleteDealDialog
          dealId={deal.id}
          clientName={deal.clientName}
          canDelete={canDelete}
          redirectTo="/kanban"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
            className="flex w-full min-w-0 items-center gap-1.5 text-left sm:gap-3"
          >
            <h1 className="min-w-0 flex-1 truncate text-lg font-semibold leading-tight tracking-tight sm:text-2xl">
              {deal.clientName}
            </h1>
            <Badge
              variant="outline"
              className={cn(
                STAGE_COLORS[deal.currentStage],
                "shrink-0 px-1.5 py-0 text-[10px] font-medium sm:px-2.5 sm:py-0.5 sm:text-xs",
              )}
            >
              {STAGE_LABELS[deal.currentStage]}
            </Badge>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                detailsOpen && "rotate-180",
              )}
              aria-hidden
            />
          </button>

          {detailsOpen && (
            <>
              <p className="mt-1 font-mono text-sm text-muted-foreground">{deal.vin}</p>
              <p className="mt-1 text-sm text-muted-foreground">{carLine}</p>

              <div className="mt-1 flex items-center justify-between gap-2 sm:hidden">
                <p className="min-w-0 truncate text-[11px] text-muted-foreground">
                  Менеджеры: {managersLabel}
                </p>
                <p className="shrink-0 text-sm font-semibold leading-none">
                  {formatCurrency(deal.prepayment)}
                </p>
              </div>

              <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
                Менеджеры: {managersLabel}
              </p>
            </>
          )}
        </div>

        {detailsOpen && (
          <div className="hidden sm:block sm:text-right">
            <p className="text-2xl font-semibold">{formatCurrency(deal.prepayment)}</p>
            <p className="text-xs text-muted-foreground">предоплата</p>
          </div>
        )}
      </div>
    </div>
  );
}
