"use client";

import type { ReactNode } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  CustomsCalculatorInput,
  CustomsCalculatorResult,
} from "@/lib/customs-calculator";

function formatForeignNote(amount: number, code: "CNY" | "KRW" | "USD"): string | undefined {
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return `${amount.toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
  })} ${code}`;
}

function priceToForeign(
  input: CustomsCalculatorInput,
  priceRub: number,
  code: "CNY" | "KRW" | "USD",
): number {
  if (input.currency === code) return input.price;
  const rate = input.rates[code];
  if (!rate || rate <= 0) return 0;
  return priceRub / rate;
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
  const originCountry = result.originCountry ?? input.originCountry ?? "china";
  const isKorea = originCountry === "korea";
  const isKyrgyzstan = originCountry === "kyrgyzstan";
  const rateCode = isKorea ? "KRW" : isKyrgyzstan ? "USD" : "CNY";
  const rateValue = input.rates[rateCode];
  const originLabel = isKorea ? "Корея" : isKyrgyzstan ? "Киргизия" : "Китай";

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          {[
            createdAt ? new Date(createdAt).toLocaleString("ru-RU") : null,
            createdByName,
            originLabel,
            `Курс ${rateCode}: ${rateValue.toLocaleString("ru-RU", {
              maximumFractionDigits: 2,
              minimumFractionDigits: 2,
            })} ₽`,
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
          note={formatForeignNote(priceToForeign(input, result.priceRub, rateCode), rateCode)}
        />
        {isKorea ? (
          <>
            <ResultRow
              label="Комиссия стоянки"
              value={result.parkingFeeRub ?? 0}
              note={formatForeignNote(result.parkingFeeKrw ?? 0, "KRW")}
            />
            <ResultRow
              label="Документы и доставка до РФ"
              value={result.koreaDocsDeliveryRub ?? 0}
              note={formatForeignNote(result.koreaDocsDeliveryKrw ?? 0, "KRW")}
            />
            <ResultRow
              label={result.firstPaymentLabel ?? "Первый платёж по инвойсу"}
              value={result.vtbTotalRub}
              note={
                result.firstPaymentNote ??
                "Авто + комиссия стоянки + документы и доставка до РФ"
              }
              emphasize
            />
          </>
        ) : isKyrgyzstan ? (
          <>
            <ResultRow
              label="Доставка до города"
              value={result.cityDeliveryRub ?? 0}
              note={formatForeignNote(result.cityDeliveryUsd ?? 0, "USD")}
            />
            <ResultRow
              label={result.firstPaymentLabel ?? "Итог с комиссией ВТБ"}
              value={result.vtbTotalRub}
              note={result.firstPaymentNote ?? "Авто + доставка до города + 2%"}
              emphasize
            />
          </>
        ) : (
          <>
            <ResultRow
              label="Расходы по Китаю"
              value={result.chinaExpensesRub}
              note={formatForeignNote(result.chinaExpensesCny, "CNY")}
            />
            <ResultRow
              label={result.firstPaymentLabel ?? "Итог с комиссией ВТБ"}
              value={result.vtbTotalRub}
              note={result.firstPaymentNote ?? "Авто + расходы по Китаю + 2%"}
              emphasize
            />
          </>
        )}
      </ResultSection>

      <ResultSection title="Расходы по России">
        <ResultRow label="Услуги брокера" value={result.brokerFeeRub} />
        {!isKyrgyzstan && (
          <>
            <ResultRow label="Таможенный сбор (ТС)" value={result.customsFee} />
            <ResultRow
              label="Таможенная пошлина (ТП)"
              value={result.customsDuty}
              note={result.customsDutyNote}
            />
          </>
        )}
        <ResultRow
          label="Утилизационный сбор (УС)"
          value={result.recyclingFee}
          note={result.recyclingNote}
        />
        {!isKyrgyzstan && (
          <>
            <ResultRow label="Акциз (А)" value={result.excise} />
            <ResultRow label="НДС" value={result.vat} note="20% от (стоимость + пошлина + акциз)" />
          </>
        )}
      </ResultSection>

      <ResultSection
        title={isKyrgyzstan ? "Доставка и услуги сопровождения" : "Доставка и доп. расходы"}
      >
        <ResultRow
          label="Доставка"
          value={result.deliveryRub}
          note={
            result.deliveryNote ??
            (input.deliveryRoute === "kazakhstan"
              ? `через Казахстан · ${(input.deliveryUsd ?? 1500).toLocaleString("ru-RU", {
                  maximumFractionDigits: 2,
                })} USD`
              : input.deliveryRoute === "vladivostok"
                ? "из Владивостока"
                : input.deliveryRoute === "ussuriysk"
                  ? "через Уссурийск"
                  : undefined)
          }
        />
        <ResultRow label="Услуги сопровождения" value={result.escortRub} />
        {(result.extraExpenses ?? []).map((item) => (
          <ResultRow key={item.id} label={item.label} value={item.amountRub} />
        ))}
      </ResultSection>
    </div>
  );
}
