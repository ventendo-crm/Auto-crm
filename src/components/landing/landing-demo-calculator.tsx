"use client";

import { useMemo, useState } from "react";
import {
  calculateCustoms,
  DEFAULT_BROKER_FEE_RUB,
  DEFAULT_DELIVERY_RUB,
  DEFAULT_ESCORT_RUB,
} from "@/lib/customs-calculator/calculate";
import {
  CarAge,
  CurrencyCode,
  DEFAULT_EXCHANGE_RATES,
  DEFAULT_KOREA_BROKER_FEE_RUB,
  DEFAULT_KOREA_DELIVERY_RUB,
  EngineType,
  ImporterType,
  OriginCountry,
} from "@/lib/customs-calculator/rates";
import styles from "@/components/landing/landing.module.css";

const COUNTRIES: Array<{ id: OriginCountry; label: string; currency: CurrencyCode; price: string }> = [
  { id: "china", label: "Китай", currency: "CNY", price: "148000" },
  { id: "korea", label: "Корея", currency: "KRW", price: "28500000" },
  { id: "kyrgyzstan", label: "Киргизия", currency: "USD", price: "18500" },
];

const IMPORTERS: Array<{ value: ImporterType; label: string }> = [
  { value: "personal", label: "Физлицо · личное" },
  { value: "resale", label: "Физлицо · перепродажа" },
  { value: "legal", label: "Юрлицо" },
];

const AGES: Array<{ value: CarAge; label: string }> = [
  { value: "new", label: "Новый" },
  { value: "under3", label: "До 3 лет" },
  { value: "from3to5", label: "3–5 лет" },
  { value: "from5to7", label: "5–7 лет" },
  { value: "over7", label: "Более 7 лет" },
];

const ENGINES: Array<{ value: EngineType; label: string }> = [
  { value: "petrol", label: "Бензин" },
  { value: "diesel", label: "Дизель" },
  { value: "electric", label: "Электро" },
];

const CURRENCIES: Array<{ value: CurrencyCode; label: string }> = [
  { value: "CNY", label: "CNY" },
  { value: "KRW", label: "KRW" },
  { value: "USD", label: "USD" },
  { value: "RUB", label: "RUB" },
];

function parseAmount(value: string): number {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function formatRub(value: number): string {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

function chinaExpensesForAge(age: CarAge): number {
  return age === "new" ? 5000 : 12000;
}

function ResultRow({
  label,
  value,
  note,
  strong,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
}) {
  return (
    <li
      className={`flex items-start justify-between gap-3 border-b border-[var(--landing-line)] pb-2 ${
        strong ? "border-b-0 pt-1" : ""
      }`}
    >
      <span className="min-w-0">
        <span
          className={`block text-xs ${
            strong ? "font-semibold text-[var(--landing-ink)]" : "text-[var(--landing-muted)]"
          }`}
        >
          {label}
        </span>
        {note ? <span className="mt-0.5 block text-[10px] text-[var(--landing-muted)]">{note}</span> : null}
      </span>
      <span
        className={`shrink-0 text-xs font-semibold ${
          strong ? "text-sm text-[var(--landing-brand-deep)]" : "text-[var(--landing-ink)]"
        }`}
      >
        {value}
      </span>
    </li>
  );
}

export function LandingDemoCalculator() {
  const [countryId, setCountryId] = useState<OriginCountry>("china");
  const [currency, setCurrency] = useState<CurrencyCode>("CNY");
  const [importer, setImporter] = useState<ImporterType>("personal");
  const [age, setAge] = useState<CarAge>("from3to5");
  const [engine, setEngine] = useState<EngineType>("petrol");
  const [price, setPrice] = useState("148000");
  const [customsPrice, setCustomsPrice] = useState("");
  const [volumeLiters, setVolumeLiters] = useState("2.0");
  const [powerHp, setPowerHp] = useState("150");

  const country = COUNTRIES.find((item) => item.id === countryId) ?? COUNTRIES[0];
  const isElectric = engine === "electric";
  const showCustomsPrice = age === "new";

  const result = useMemo(() => {
    const volumeCc = isElectric ? 0 : Math.round(parseAmount(volumeLiters) * 1000);
    const customsAmount = parseAmount(customsPrice);
    return calculateCustoms({
      originCountry: country.id,
      importer,
      age,
      engine,
      powerHp: parseAmount(powerHp),
      volumeCc,
      price: parseAmount(price),
      customsPrice: showCustomsPrice && customsAmount > 0 ? customsAmount : undefined,
      currency,
      rates: DEFAULT_EXCHANGE_RATES,
      chinaExpensesCny: country.id === "china" ? chinaExpensesForAge(age) : undefined,
      brokerFeeRub: country.id === "korea" ? DEFAULT_KOREA_BROKER_FEE_RUB : DEFAULT_BROKER_FEE_RUB,
      deliveryRub: country.id === "korea" ? DEFAULT_KOREA_DELIVERY_RUB : DEFAULT_DELIVERY_RUB,
      escortRub: DEFAULT_ESCORT_RUB,
    });
  }, [
    age,
    country.id,
    currency,
    customsPrice,
    engine,
    importer,
    isElectric,
    powerHp,
    price,
    showCustomsPrice,
    volumeLiters,
  ]);

  const handleCountry = (next: OriginCountry) => {
    const preset = COUNTRIES.find((item) => item.id === next);
    if (!preset) return;
    setCountryId(next);
    setCurrency(preset.currency);
    setPrice(preset.price);
  };

  return (
    <div className="overflow-hidden border border-[var(--landing-line)] bg-white shadow-[0_20px_60px_rgba(22,24,29,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--landing-line)] px-4 py-3 sm:px-5">
        <div>
          <p className="text-sm font-semibold text-[var(--landing-ink)]">
            Калькулятор растаможки авто
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--landing-muted)]">
            Пошлина, утильсбор, НДС и расходы · Китай, Корея, Киргизия
          </p>
        </div>
        <div className="flex gap-1.5">
          {COUNTRIES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleCountry(item.id)}
              className={`px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                item.id === country.id
                  ? "bg-[var(--landing-brand)] text-white"
                  : "bg-[var(--landing-wash)] text-[var(--landing-muted)] hover:text-[var(--landing-ink)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2">
        <div className="space-y-4 border-b border-[var(--landing-line)] p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--landing-muted)]">
                Кто ввозит
              </span>
              <select
                className={styles.demoInput}
                value={importer}
                onChange={(event) => setImporter(event.target.value as ImporterType)}
              >
                {IMPORTERS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--landing-muted)]">
                Двигатель
              </span>
              <select
                className={styles.demoInput}
                value={engine}
                onChange={(event) => setEngine(event.target.value as EngineType)}
              >
                {ENGINES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-3">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--landing-muted)]">
                Цена авто
              </span>
              <input
                className={styles.demoInput}
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                aria-label="Цена авто"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--landing-muted)]">
                Валюта
              </span>
              <select
                className={styles.demoInput}
                value={currency}
                onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
              >
                {CURRENCIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {showCustomsPrice ? (
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--landing-muted)]">
                Стоимость для таможни (необязательно)
              </span>
              <input
                className={styles.demoInput}
                inputMode="decimal"
                value={customsPrice}
                onChange={(event) => setCustomsPrice(event.target.value)}
                placeholder="Если таможня считает от каталога"
                aria-label="Стоимость для таможни"
              />
            </label>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--landing-muted)]">
                Возраст
              </span>
              <select
                className={styles.demoInput}
                value={age}
                onChange={(event) => setAge(event.target.value as CarAge)}
              >
                {AGES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--landing-muted)]">
                Мощность, л.с.
              </span>
              <input
                className={styles.demoInput}
                inputMode="decimal"
                value={powerHp}
                onChange={(event) => setPowerHp(event.target.value)}
                aria-label="Мощность в лошадиных силах"
              />
            </label>
          </div>

          {!isElectric ? (
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--landing-muted)]">
                Объём двигателя, л
              </span>
              <input
                className={styles.demoInput}
                inputMode="decimal"
                value={volumeLiters}
                onChange={(event) => setVolumeLiters(event.target.value)}
                aria-label="Объём двигателя в литрах"
              />
              <span className="mt-1 block text-[10px] text-[var(--landing-muted)]">
                ≈ {Math.round(parseAmount(volumeLiters) * 1000).toLocaleString("ru-RU")} см³
              </span>
            </label>
          ) : null}

          <p className="text-xs leading-relaxed text-[var(--landing-muted)]">
            Демо с типовыми расходами и курсами. В CRM — актуальные курсы, шаблоны компании, поиск
            авто и сохранение расчёта в сделку.
          </p>
        </div>

        <div className="bg-[var(--landing-surface)]/60 p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--landing-muted)]">
            Результат растаможки
          </p>
          {result ? (
            <ul className="mt-4 space-y-2.5">
              <ResultRow label="Авто" value={formatRub(result.priceRub)} />
              {result.customsPriceRub != null ? (
                <ResultRow
                  label="Стоимость для таможни"
                  value={formatRub(result.customsPriceRub)}
                />
              ) : null}
              <ResultRow
                label={result.firstPaymentLabel}
                value={formatRub(result.vtbTotalRub)}
                note={result.firstPaymentNote}
              />
              {result.customsFee > 0 ? (
                <ResultRow label="Таможенный сбор" value={formatRub(result.customsFee)} />
              ) : null}
              {result.customsDuty > 0 ? (
                <ResultRow
                  label="Пошлина"
                  value={formatRub(result.customsDuty)}
                  note={result.customsDutyNote || undefined}
                />
              ) : null}
              {result.excise > 0 ? (
                <ResultRow label="Акциз" value={formatRub(result.excise)} />
              ) : null}
              {result.vat > 0 ? <ResultRow label="НДС" value={formatRub(result.vat)} /> : null}
              <ResultRow
                label="Утильсбор"
                value={formatRub(result.recyclingFee)}
                note={result.recyclingNote || undefined}
              />
              <ResultRow label="Таможня и утиль всего" value={formatRub(result.totalCustoms)} />
              {result.brokerFeeRub > 0 ? (
                <ResultRow label="Брокер" value={formatRub(result.brokerFeeRub)} />
              ) : null}
              {result.deliveryRub > 0 ? (
                <ResultRow
                  label="Доставка"
                  value={formatRub(result.deliveryRub)}
                  note={result.deliveryNote || undefined}
                />
              ) : null}
              {result.escortRub > 0 ? (
                <ResultRow label="Сопровождение" value={formatRub(result.escortRub)} />
              ) : null}
              <ResultRow label="Итого под ключ" value={formatRub(result.totalWithCar)} strong />
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[var(--landing-muted)]">
              Укажите цену, мощность и объём — посчитаем сразу.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
