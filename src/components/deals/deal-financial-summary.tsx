"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { buildDealFinancialSummary } from "@/lib/services/deal-finances";
import { DealDetail, DealFinancialSummary } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

interface DealFinancialSummaryProps {
  deal: DealDetail;
}

function SummaryRow({
  label,
  value,
  emphasis = false,
  positive,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={emphasis ? "text-sm font-medium" : "text-sm text-muted-foreground"}>
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-medium",
          emphasis && "text-base font-semibold",
          positive === true && "text-emerald-600 dark:text-emerald-400",
          positive === false && "text-rose-600 dark:text-rose-400",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function DealFinancialSummaryCard({ deal }: DealFinancialSummaryProps) {
  const [summary, setSummary] = useState<DealFinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const expenses = await api.deals.expenses.list(deal.id);
      setSummary(buildDealFinancialSummary(deal, expenses));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить финансы");
    } finally {
      setLoading(false);
    }
  }, [deal]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4" />
          Финансовая сводка
        </CardTitle>
        <CardDescription>Только для менеджера и администратора</CardDescription>
      </CardHeader>
      <CardContent>
        {loading || !summary ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                От клиента
              </p>
              <SummaryRow label="Предоплата" value={formatCurrency(summary.prepayment)} />
              <SummaryRow label="Остаток" value={formatCurrency(summary.balance)} />
              <SummaryRow
                label="Итого от клиента"
                value={formatCurrency(summary.clientTotal)}
                emphasis
              />
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Затраты
              </p>
              <SummaryRow
                label="Операционные расходы"
                value={formatCurrency(summary.expensesTotal)}
                emphasis
              />
            </div>

            <div className="rounded-lg border border-brand/20 bg-brand-muted/30 p-4">
              <SummaryRow
                label="Ориентировочная маржа"
                value={formatCurrency(summary.estimatedMargin)}
                emphasis
                positive={summary.estimatedMargin > 0 ? true : summary.estimatedMargin < 0 ? false : undefined}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Предоплата + остаток − операционные расходы по сделке
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
