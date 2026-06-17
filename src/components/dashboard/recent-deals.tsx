import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STAGE_COLORS, STAGE_LABELS } from "@/lib/constants";
import { DashboardRecentDeal } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export function RecentDeals({ deals }: { deals: DashboardRecentDeal[] }) {
  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Последние сделки</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/kanban">
            Канбан <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {deals.length === 0 && (
          <p className="text-sm text-muted-foreground">Сделок пока нет</p>
        )}
        {deals.map((deal) => (
          <Link
            key={deal.id}
            href={`/deals/${deal.id}`}
            className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{deal.clientName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {deal.carBrand} {deal.carModel} · {deal.vin}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium">{formatCurrency(deal.prepayment)}</p>
                <p className="text-xs text-muted-foreground">{formatDate(deal.updatedAt)}</p>
              </div>
              <Badge variant="outline" className={STAGE_COLORS[deal.currentStage]}>
                {STAGE_LABELS[deal.currentStage]}
              </Badge>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
