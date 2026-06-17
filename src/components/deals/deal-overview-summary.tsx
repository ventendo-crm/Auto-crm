"use client";

import { Car, ClipboardList, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { AdditionalOptionGroupState } from "@/lib/services/additional-options";

interface DealOverviewSummaryProps {
  dealId: string;
  carBrand?: string | null;
  carModel?: string | null;
  carYear?: number | null;
  active?: boolean;
}

function formatCarLine(
  carBrand?: string | null,
  carModel?: string | null,
  carYear?: number | null,
): string {
  const parts = [carBrand, carModel].filter(Boolean);
  if (parts.length === 0) return "—";
  const line = parts.join(" ");
  return carYear ? `${line} · ${carYear}` : line;
}

function getCheckedGroups(groups: AdditionalOptionGroupState[]) {
  return groups
    .map((group) => ({
      ...group,
      options: group.options.filter((option) => option.checked),
    }))
    .filter((group) => group.options.length > 0);
}

export function DealOverviewSummary({
  dealId,
  carBrand,
  carModel,
  carYear,
  active = true,
}: DealOverviewSummaryProps) {
  const [groups, setGroups] = useState<AdditionalOptionGroupState[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.deals.additionalOptions.list(dealId);
      setGroups(data);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    void load();
  }, [active, load, carBrand, carModel, carYear]);

  const checkedGroups = useMemo(() => getCheckedGroups(groups), [groups]);
  const checkedCount = useMemo(
    () => checkedGroups.reduce((sum, group) => sum + group.options.length, 0),
    [checkedGroups],
  );

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4" />
          Сводное поле
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <Car className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Марка / модель</p>
              <p className="mt-1 text-sm font-medium">
                {formatCarLine(carBrand, carModel, carYear)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Дополнительные опции
            </p>
            {!loading && checkedCount > 0 && (
              <Badge variant="secondary" className="font-normal">
                {checkedCount}
              </Badge>
            )}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загрузка опций...
            </div>
          ) : checkedCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              Пока ничего не выбрано во вкладке «Дополнительные опции»
            </p>
          ) : (
            <div className="space-y-4">
              {checkedGroups.map((group) => (
                <div key={group.id} className="space-y-2">
                  <p className="text-sm font-medium">{group.title}</p>
                  <ul className="space-y-1.5">
                    {group.options.map((option) => (
                      <li
                        key={option.key}
                        className="flex items-start gap-2 text-sm text-foreground"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{option.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
