"use client";

import { Calculator, ChevronDown, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
  canDelete?: boolean;
  title?: string;
}

export function DealCustomsEstimatesPanel({
  dealId,
  active = true,
  showCalculatorLink = false,
  canDelete = false,
  title = "Расчёт растаможки",
}: DealCustomsEstimatesPanelProps) {
  const [estimates, setEstimates] = useState<DealCustomsEstimateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.deals.customsEstimates.list(dealId);
      setEstimates(data);
      setExpandedId((current) => {
        if (current && data.some((item) => item.id === current)) return current;
        return data[0]?.id ?? null;
      });
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

  const handleDelete = async (estimate: DealCustomsEstimateItem) => {
    if (!window.confirm("Удалить этот расчёт? Клиент больше не увидит его в карточке.")) {
      return;
    }

    setDeletingId(estimate.id);
    try {
      await api.deals.customsEstimates.delete(dealId, estimate.id);
      setEstimates((current) => {
        const next = current.filter((item) => item.id !== estimate.id);
        setExpandedId((expanded) => {
          if (expanded !== estimate.id) return expanded;
          return next[0]?.id ?? null;
        });
        return next;
      });
      toast.success("Расчёт удалён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить расчёт");
    } finally {
      setDeletingId(null);
    }
  };

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
            <div className="flex flex-wrap gap-2">
              {current && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/calculator?dealId=${dealId}&estimateId=${current.id}`}>
                    Дублировать в калькулятор
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" size="sm">
                <Link href="/calculator">Открыть калькулятор</Link>
              </Button>
            </div>
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
                const isDeleting = deletingId === estimate.id;
                return (
                  <div key={estimate.id} className="rounded-xl border">
                    <div className="flex items-center gap-1 pr-2">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
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
                      {showCalculatorLink && (
                        <Button asChild variant="ghost" size="sm" className="shrink-0">
                          <Link href={`/calculator?dealId=${dealId}&estimateId=${estimate.id}`}>
                            В калькулятор
                          </Link>
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          disabled={isDeleting || deletingId !== null}
                          aria-label="Удалить расчёт"
                          onClick={() => void handleDelete(estimate)}
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
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
