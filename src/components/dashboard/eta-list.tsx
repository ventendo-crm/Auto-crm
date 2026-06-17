import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardChartData } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface EtaListProps {
  etaDeals: DashboardChartData["etaDeals"];
}

export function EtaList({ etaDeals }: EtaListProps) {
  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-amber-600" />
          Ближайшие прибытия
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {etaDeals.length === 0 && (
          <p className="text-sm text-muted-foreground">Нет предстоящих прибытий</p>
        )}
        {etaDeals.slice(0, 6).map((deal) => (
          <Link
            key={deal.dealId}
            href={`/deals/${deal.dealId}`}
            className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{deal.clientName}</p>
              <p className="text-xs text-muted-foreground">{formatDate(deal.date)}</p>
            </div>
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              через {deal.days} дн.
            </Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
