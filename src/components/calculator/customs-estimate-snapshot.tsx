"use client";

import type { ReactNode } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  CustomsCalculatorInput,
  CustomsCalculatorResult,
} from "@/lib/customs-calculator";

function formatCnyNote(amountCny: number): string | undefined {
  if (!Number.isFinite(amountCny) || amountCny <= 0) return undefined;
  return `${amountCny.toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
  })} CNY`;
}

function priceToCny(input: CustomsCalculatorInput, priceRub: number): number {
  if (input.currency === "CNY") return input.price;
  if (!input.rates.CNY || input.rates.CNY <= 0) return 0;
  return priceRub / input.rates.CNY;
}

function ResultRow({
  label,
  value,
  note,
  emphasize,
}: {
  label: string;
  value: number;
  note?: string;
  emphasize?: boolean;
}) {
  if (value === 0) return null;

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-border/50 py-3 last:border-b-0",
        emphasize && "border-b-0 pt-4",
      )}
    >
      <div className="min-w-0">
        <p className={cn("text-sm", emphasize ? "font-semibold" : "text-muted-foreground")}>
          {label}
        </p>
        {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      </div>
      <p
        className={cn(
          "shrink-0 text-right tabular-nums",
          emphasize ? "text-xl font-semibold" : "text-sm font-medium",
        )}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function ResultSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-muted/10 px-4 py-1">
      {title && (
        <p className="border-b border-border/40 pb-2 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      )}
      <div>{children}</div>
    </div>
  );
}

export function CustomsEstimateSnapshot({
  input,
  result,
  createdAt,
  createdByName,
  note,
}: {
  input: CustomsCalculatorInput;
  result: CustomsCalculatorResult;
  createdAt?: string;
  createdByName?: string;
  note?: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          {[
            createdAt ? new Date(createdAt).toLocaleString("ru-RU") : null,
            createdByName,
            `Курс CNY: ${input.rates.CNY.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} ₽`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
      </div>

      {result.totalWithCar !== 0 && (
        <div className="rounded-xl border border-brand/20 bg-brand-muted/40 px-4 py-4">
          <p className="text-sm text-muted-foreground">Итого со всеми расходами</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatCurrency(result.totalWithCar)}
          </p>
        </div>
      )}

      <ResultSection>
        <ResultRow
          label="Стоимость авто в рублях"
          value={result.priceRub}
          note={formatCnyNote(priceToCny(input, result.priceRub))}
        />
        <ResultRow
          label="Расходы по Китаю"
          value={result.chinaExpensesRub}
          note={formatCnyNote(result.chinaExpensesCny)}
        />
        <ResultRow
          label="Итог с комиссией ВТБ"
          value={result.vtbTotalRub}
          note="Авто + расходы по Китаю + 2%"
          emphasize
        />
      </ResultSection>

      <ResultSection title="Расходы по России">
        <ResultRow label="Услуги брокера" value={result.brokerFeeRub} />
        <ResultRow label="Таможенный сбор (ТС)" value={result.customsFee} />
        <ResultRow
          label="Таможенная пошлина (ТП)"
          value={result.customsDuty}
          note={result.customsDutyNote}
        />
        <ResultRow
          label="Утилизационный сбор (УС)"
          value={result.recyclingFee}
          note={result.recyclingNote}
        />
        <ResultRow label="Акциз (А)" value={result.excise} />
        <ResultRow label="НДС" value={result.vat} note="20% от (стоимость + пошлина + акциз)" />
      </ResultSection>

      <ResultSection title="Доставка по РФ">
        <ResultRow label="Доставка" value={result.deliveryRub} />
        <ResultRow label="Услуги сопровождения" value={result.escortRub} />
      </ResultSection>
    </div>
  );
}
