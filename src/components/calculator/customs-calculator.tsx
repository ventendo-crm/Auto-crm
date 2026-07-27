"use client";

import { Calculator as CalculatorIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  calculateCustoms,
  CarAge,
  CurrencyCode,
  DEFAULT_EXCHANGE_RATES,
  EngineType,
  ExchangeRates,
  ImporterType,
} from "@/lib/customs-calculator";
import { cn, formatCurrency } from "@/lib/utils";

const IMPORTER_OPTIONS: Array<{ value: ImporterType; label: string }> = [
  { value: "personal", label: "Физ. лицо (для личного использования)" },
  { value: "resale", label: "Физ. лицо (для перепродажи)" },
  { value: "legal", label: "Юридическое лицо" },
];

const AGE_OPTIONS: Array<{ value: CarAge; label: string }> = [
  { value: "under3", label: "до 3х лет" },
  { value: "from3to5", label: "от 3х до 5 лет" },
  { value: "from5to7", label: "от 5 до 7 лет" },
  { value: "over7", label: "более 7 лет" },
];

const ENGINE_OPTIONS: Array<{ value: EngineType; label: string }> = [
  { value: "petrol", label: "Бензин" },
  { value: "diesel", label: "Дизель" },
  { value: "electric", label: "Электро и последовательный гибрид" },
];

const CURRENCY_OPTIONS: Array<{ value: CurrencyCode; label: string }> = [
  { value: "RUB", label: "Рубль" },
  { value: "USD", label: "Доллар США" },
  { value: "EUR", label: "Евро" },
  { value: "CNY", label: "Юань" },
  { value: "AED", label: "Дирхам ОАЭ" },
  { value: "KRW", label: "Вона" },
  { value: "JPY", label: "Иена" },
];

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-colors sm:text-sm",
              active
                ? "border-brand/40 bg-brand-muted text-foreground shadow-sm"
                : "border-border/60 bg-card text-muted-foreground hover:border-brand/20 hover:bg-muted/40",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
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
      <p className={cn("shrink-0 text-right tabular-nums", emphasize ? "text-xl font-semibold" : "text-sm font-medium")}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}

export function CustomsCalculator() {
  const [importer, setImporter] = useState<ImporterType>("personal");
  const [age, setAge] = useState<CarAge>("under3");
  const [engine, setEngine] = useState<EngineType>("petrol");
  const [powerHp, setPowerHp] = useState("150");
  const [volumeCc, setVolumeCc] = useState("2000");
  const [price, setPrice] = useState("25000");
  const [currency, setCurrency] = useState<CurrencyCode>("EUR");
  const [rates, setRates] = useState<ExchangeRates>(DEFAULT_EXCHANGE_RATES);
  const [submitted, setSubmitted] = useState(false);

  const result = useMemo(() => {
    if (!submitted) return null;
    return calculateCustoms({
      importer,
      age,
      engine,
      powerHp: Number(powerHp.replace(",", ".")),
      volumeCc: Number(volumeCc.replace(",", ".")),
      price: Number(price.replace(",", ".")),
      currency,
      rates,
    });
  }, [submitted, importer, age, engine, powerHp, volumeCc, price, currency, rates]);

  const handleCalculate = () => {
    setSubmitted(true);
  };

  const updateRate = (key: keyof ExchangeRates, value: string) => {
    const next = Number(value.replace(",", "."));
    if (!Number.isFinite(next) || next <= 0) return;
    setRates((current) => ({ ...current, [key]: next }));
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-muted text-brand">
              <CalculatorIcon className="h-4 w-4" />
            </span>
            Калькулятор растаможки
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Расчёт по ставкам 2026 года: таможенный сбор, пошлина, акциз, НДС и утильсбор.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Автомобиль ввозит</Label>
            <SegmentedControl value={importer} options={IMPORTER_OPTIONS} onChange={setImporter} />
          </div>

          <div className="space-y-2">
            <Label>Возраст автомобиля</Label>
            <SegmentedControl value={age} options={AGE_OPTIONS} onChange={setAge} />
          </div>

          <div className="space-y-2">
            <Label>Тип двигателя</Label>
            <SegmentedControl value={engine} options={ENGINE_OPTIONS} onChange={setEngine} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="power-hp">Мощность, л.с.</Label>
              <Input
                id="power-hp"
                type="number"
                min={1}
                step="1"
                value={powerHp}
                onChange={(event) => setPowerHp(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="volume-cc">Объём двигателя, см³</Label>
              <Input
                id="volume-cc"
                type="number"
                min={1}
                step="1"
                value={volumeCc}
                onChange={(event) => setVolumeCc(event.target.value)}
                disabled={engine === "electric"}
                placeholder={engine === "electric" ? "Не требуется" : undefined}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <div className="space-y-2">
              <Label htmlFor="car-price">Стоимость автомобиля</Label>
              <Input
                id="car-price"
                type="number"
                min={1}
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Валюта</Label>
              <Select value={currency} onValueChange={(value) => setCurrency(value as CurrencyCode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <p className="text-sm font-medium">Курсы валют к рублю</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(DEFAULT_EXCHANGE_RATES) as Array<keyof ExchangeRates>).map((code) => (
                <div key={code} className="space-y-1.5">
                  <Label htmlFor={`rate-${code}`} className="text-xs text-muted-foreground">
                    {code}
                  </Label>
                  <Input
                    id={`rate-${code}`}
                    type="number"
                    min={0.0001}
                    step="0.0001"
                    value={rates[code]}
                    onChange={(event) => updateRate(code, event.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <Button type="button" variant="brand" className="w-full sm:w-auto" onClick={handleCalculate}>
            Рассчитать
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle>Результат расчёта</CardTitle>
          <p className="text-sm text-muted-foreground">
            Итоговые суммы в рублях. Для электромобилей НДС и акциз считаются и для физлиц.
          </p>
        </CardHeader>
        <CardContent>
          {!submitted && (
            <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
              Заполните параметры и нажмите «Рассчитать»
            </div>
          )}

          {submitted && !result && (
            <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50/50 px-6 py-12 text-center text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              Проверьте мощность, объём двигателя и стоимость автомобиля
            </div>
          )}

          {result && (
            <div>
              <ResultRow label="Стоимость авто в рублях" value={result.priceRub} />
              <ResultRow label="Таможенный сбор (ТС)" value={result.customsFee} />
              <ResultRow
                label="Таможенная пошлина (ТП)"
                value={result.customsDuty}
                note={result.customsDutyNote}
              />
              <ResultRow label="Акциз (А)" value={result.excise} />
              <ResultRow label="НДС" value={result.vat} note="20% от (стоимость + пошлина + акциз)" />
              <ResultRow
                label="Утилизационный сбор (УС)"
                value={result.recyclingFee}
                note={result.recyclingNote}
              />
              <ResultRow label="Итого растаможка" value={result.totalCustoms} emphasize />
              <div className="mt-2 rounded-xl border border-brand/20 bg-brand-muted/40 px-4 py-4">
                <p className="text-sm text-muted-foreground">Стоимость автомобиля + растаможка</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatCurrency(result.totalWithCar)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
