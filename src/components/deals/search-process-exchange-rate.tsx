"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { CustomCalculatorOrigin } from "@/lib/customs-calculator/custom-origins";
import { exchangeRateLabelForOrigin } from "@/lib/customs-calculator/deal-exchange-rate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { SearchProcessLinks } from "@/lib/types";

function parseRateInput(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

interface SearchProcessExchangeRatePanelProps {
  dealId: string;
  links: SearchProcessLinks;
  destinationCountry?: string | null;
  customOrigins?: CustomCalculatorOrigin[];
  canEdit?: boolean;
  estimatesCount?: number;
  onLinksUpdated?: (links: SearchProcessLinks) => void;
  onRecalculated?: () => void;
}

export function SearchProcessExchangeRatePanel({
  dealId,
  links,
  destinationCountry,
  customOrigins = [],
  canEdit = false,
  estimatesCount = 0,
  onLinksUpdated,
  onRecalculated,
}: SearchProcessExchangeRatePanelProps) {
  const origin = destinationCountry ?? "china";
  const rateLabel = exchangeRateLabelForOrigin(origin, customOrigins);
  const [value, setValue] = useState(links.exchangeRate != null ? String(links.exchangeRate) : "");
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    setValue(links.exchangeRate != null ? String(links.exchangeRate) : "");
  }, [links.exchangeRate]);

  const saveRate = async () => {
    const parsed = parseRateInput(value);
    const current = links.exchangeRate;

    if (parsed === current) return;
    if (value.trim() && parsed == null) {
      toast.error("Введите корректный курс, например 12.1");
      setValue(current != null ? String(current) : "");
      return;
    }

    setSaving(true);
    try {
      const updated = await api.searchProcess.updateLinks(dealId, {
        exchangeRate: parsed,
      });
      onLinksUpdated?.(updated);
      setValue(updated.exchangeRate != null ? String(updated.exchangeRate) : "");
      toast.success(parsed == null ? "Курс сброшен — используются курсы Google Finance" : "Курс сохранён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить курс");
      setValue(current != null ? String(current) : "");
    } finally {
      setSaving(false);
    }
  };

  const recalculate = async () => {
    if (links.exchangeRate == null) {
      toast.error("Сначала задайте курс для этой сделки");
      return;
    }

    setRecalculating(true);
    try {
      const result = await api.searchProcess.recalculateEstimates(dealId);
      if (result.updated === 0) {
        toast.message("Нет сохранённых расчётов для обновления");
      } else {
        toast.success(`Обновлено расчётов: ${result.updated}`);
        onRecalculated?.();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обновить расчёты");
    } finally {
      setRecalculating(false);
    }
  };

  if (!canEdit) {
    if (links.exchangeRate == null) return null;

    return (
      <div className="rounded-lg border bg-muted/20 p-3">
        <p className="text-xs text-muted-foreground">{rateLabel}</p>
        <p className="mt-1 text-sm font-medium">{links.exchangeRate}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border bg-background/60 p-4">
      <div className="space-y-1.5">
        <Label htmlFor="search-process-exchange-rate" className="text-xs">
          {rateLabel}
        </Label>
        <div className="relative">
          <Input
            id="search-process-exchange-rate"
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => void saveRate()}
            placeholder="12.1"
            disabled={saving}
          />
          {saving && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Если поле пустое — мини-калькулятор берёт курсы Google Finance. Курс действует для всех
          вариантов этой сделки.
        </p>
      </div>

      {estimatesCount > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          disabled={recalculating || links.exchangeRate == null}
          onClick={() => void recalculate()}
        >
          {recalculating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Актуализировать все расчёты ({estimatesCount})
        </Button>
      )}
    </div>
  );
}
