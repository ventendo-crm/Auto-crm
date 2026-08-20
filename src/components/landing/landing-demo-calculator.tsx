"use client";

import { useMemo, useState } from "react";
import { calculateCustoms } from "@/lib/customs-calculator/calculate";
import {
  CarAge,
  CurrencyCode,
  DEFAULT_EXCHANGE_RATES,
  OriginCountry,
} from "@/lib/customs-calculator/rates";
import styles from "@/components/landing/landing.module.css";

const COUNTRIES: Array<{ id: OriginCountry; label: string; currency: CurrencyCode; price: string }> = [
  { id: "china", label: "Китай", currency: "CNY", price: "148000" },
  { id: "korea", label: "Корея", currency: "KRW", price: "28500000" },
  { id: "kyrgyzstan", label: "Киргизия", currency: "USD", price: "18500" },
];

const AGES: Array<{ value: CarAge; label: string }> = [
  { value: "new", label: "Новый" },
  { value: "under3", label: "До 3 лет" },
  { value: "from3to5", label: "3–5 лет" },
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

export function LandingDemoCalculator() {
  const [countryId, setCountryId] = useState<OriginCountry>("china");
  const [age, setAge] = useState<CarAge>("from3to5");
  const [price, setPrice] = useState("148000");
  const [volumeLiters, setVolumeLiters] = useState("2.0");

  const country = COUNTRIES.find((item) => item.id === countryId) ?? COUNTRIES[0];

  const result = useMemo(() => {
    const volumeCc = Math.round(parseAmount(volumeLiters) * 1000);
    return calculateCustoms({
      originCountry: country.id,
      importer: "personal",
      age,
      engine: "petrol",
      powerHp: 150,
      volumeCc,
      price: parseAmount(price),
      currency: country.currency,
      rates: DEFAULT_EXCHANGE_RATES,
      chinaExpensesCny: country.id === "china" ? chinaExpensesForAge(age) : undefined,
    });
  }, [age, country, price, volumeLiters]);

  const handleCountry = (next: OriginCountry) => {
    const preset = COUNTRIES.find((item) => item.id === next);
    if (!preset) return;
    setCountryId(next);
    setPrice(preset.price);
  };

  return (
    <div className="overflow-hidden border border-[var(--landing-line)] bg-white shadow-[0_20px_60px_rgba(22,24,29,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--landing-line)] px-4 py-3 sm:px-5">
        <p className="text-sm font-semibold text-[var(--landing-ink)]">Демо-калькулятор растаможки</p>
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
        <div className="border-b border-[var(--landing-line)] p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--landing-muted)]">
              Цена авто, {country.currency}
            </span>
            <input
              className={styles.demoInput}
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              aria-label={`Цена авто в ${country.currency}`}
            />
          </label>

          <div className="mt-4 grid grid-cols-2 gap-3">
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
                Объём, л
              </span>
              <input
                className={styles.demoInput}
                inputMode="decimal"
                value={volumeLiters}
                onChange={(event) => setVolumeLiters(event.target.value)}
                aria-label="Объём двигателя в литрах"
              />
            </label>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-[var(--landing-muted)]">
            Бензин, 150 л.с., расчёт для физлица. Курсы демо. Полные поля, юрлицо и свои расходы — в
            CRM.
          </p>
        </div>

        <div className="bg-[var(--landing-surface)]/60 p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--landing-muted)]">
            Ориентир
          </p>
          {result ? (
            <ul className="mt-4 space-y-2.5">
              <li className="flex items-center justify-between gap-3 border-b border-[var(--landing-line)] pb-2">
                <span className="text-xs text-[var(--landing-muted)]">Авто</span>
                <span className="text-xs font-semibold text-[var(--landing-ink)]">
                  {formatRub(result.priceRub)}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 border-b border-[var(--landing-line)] pb-2">
                <span className="text-xs text-[var(--landing-muted)]">Таможня и утиль</span>
                <span className="text-xs font-semibold text-[var(--landing-ink)]">
                  {formatRub(result.totalCustoms)}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 pt-1">
                <span className="text-sm font-semibold text-[var(--landing-ink)]">Итого под ключ</span>
                <span className="text-sm font-semibold text-[var(--landing-brand-deep)]">
                  {formatRub(result.totalWithCar)}
                </span>
              </li>
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[var(--landing-muted)]">Укажите цену и объём — посчитаем сразу.</p>
          )}
        </div>
      </div>
    </div>
  );
}
