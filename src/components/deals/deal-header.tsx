"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DeleteDealDialog } from "@/components/deals/delete-deal-dialog";
import { SidebarToggle } from "@/components/layout/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STAGE_COLORS, STAGE_LABELS } from "@/lib/constants";
import { DealDetail } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface DealHeaderProps {
  deal: DealDetail;
  canDelete?: boolean;
}

export function DealHeader({ deal, canDelete }: DealHeaderProps) {
  return (
    <div className="sticky top-0 z-[60] border-b bg-card px-4 py-4 sm:px-6 sm:py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <SidebarToggle />
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
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

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{deal.clientName}</h1>
            <Badge variant="outline" className={STAGE_COLORS[deal.currentStage]}>
              {STAGE_LABELS[deal.currentStage]}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{deal.vin}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {deal.carBrand} {deal.carModel} {deal.carYear ? `· ${deal.carYear}` : ""} ·{" "}
            {deal.destinationCity}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-xl font-semibold sm:text-2xl">{formatCurrency(deal.prepayment)}</p>
          <p className="text-xs text-muted-foreground">предоплата</p>
          <p className="mt-1 text-sm text-muted-foreground">Менеджер: {deal.manager.name}</p>
        </div>
      </div>
    </div>
  );
}
