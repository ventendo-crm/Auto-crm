"use client";

import { Calculator, ChevronDown, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CustomsEstimateSnapshot } from "@/components/calculator/customs-estimate-snapshot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api-client";
import type { DealCustomsEstimateItem } from "@/lib/services/deal-customs-estimates";
import { cn, formatCurrency } from "@/lib/utils";

interface DealCustomsEstimatesPanelProps {
  dealId: string;
  active?: boolean;
  showCalculatorLink?: boolean;
  title?: string;
}

export function DealCustomsEstimatesPanel({
  dealId,
  active = true,
  showCalculatorLink = false,
  title = "Расчёт растаможки",
}: DealCustomsEstimatesPanelProps) {
  const [estimates, setEstimates] = useState<DealCustomsEstimateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.deals.customsEstimates.list(dealId);
      setEstimates(data);
      setExpandedId((current) => current ?? data[0]?.id ?? null);
    } catch {
      setEstimates([]);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    void load();
  }, [active, load]);

  const current = estimates[0] ?? null;

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4" />
            {title}
          </CardTitle>
          {showCalculatorLink && (
            <Button asChild variant="outline" size="sm">
              <Link href="/calculator">Открыть калькулятор</Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка расчётов…
          </div>
        ) : !current ? (
          <EmptyState
            icon={Calculator}
            title="Расчётов пока нет"
            description="Сохраните расчёт из калькулятора — он появится здесь и будет виден клиенту."
          />
        ) : (
          <>
            <div className="rounded-xl border border-brand/20 bg-brand-muted/40 px-4 py-4">
              <p className="text-sm text-muted-foreground">Актуальный расчёт</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {formatCurrency(current.totalWithCar)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(current.createdAt).toLocaleString("ru-RU")}
                {" · "}
                {current.createdByName}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">История расчётов</p>
              {estimates.map((estimate, index) => {
                const open = expandedId === estimate.id;
                return (
                  <div key={estimate.id} className="rounded-xl border">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                      onClick={() => setExpandedId(open ? null : estimate.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium tabular-nums">
                          {formatCurrency(estimate.totalWithCar)}
                          {index === 0 && (
                            <span className="ml-2 text-xs font-normal text-brand">актуальный</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(estimate.createdAt).toLocaleString("ru-RU")} ·{" "}
                          {estimate.createdByName}
                        </p>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          open && "rotate-180",
                        )}
                      />
                    </button>
                    {open && (
                      <div className="border-t px-4 py-4">
                        <CustomsEstimateSnapshot
                          input={estimate.input}
                          result={estimate.result}
                          createdAt={estimate.createdAt}
                          createdByName={estimate.createdByName}
                          note={estimate.note}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
