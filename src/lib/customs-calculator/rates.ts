/**
 * Ставки растаможки легковых автомобилей (РФ, 2026),
 * по публичным таблицам калькулятора ncimport.ru/calculator.
 */

export type ImporterType = "personal" | "resale" | "legal";
export type CarAge = "new" | "under3" | "from3to5" | "from5to7" | "over7";
export type EngineType = "petrol" | "diesel" | "electric";
export type CurrencyCode = "RUB" | "USD" | "CNY" | "KRW";
export type DeliveryRoute = "ussuriysk" | "kazakhstan" | "vladivostok";

/** Системные страны происхождения. */
export const SYSTEM_ORIGIN_COUNTRIES = ["china", "korea", "kyrgyzstan"] as const;
export type SystemOriginCountry = (typeof SYSTEM_ORIGIN_COUNTRIES)[number];

/**
 * Страна происхождения: системная или кастомная компании (`custom_...`).
 * Кастомные считают как Китай (полная таможня).
 */
export type OriginCountry = SystemOriginCountry | (string & {});

export function isSystemOriginCountry(value: string): value is SystemOriginCountry {
  return (SYSTEM_ORIGIN_COUNTRIES as readonly string[]).includes(value);
}

export function isKoreaOrigin(origin: string): boolean {
  return origin === "korea";
}

export function isKyrgyzstanOrigin(origin: string): boolean {
  return origin === "kyrgyzstan";
}

/** Китай и кастомные страны компании (`custom_...`). */
export function isChinaLikeOrigin(origin: string): boolean {
  return origin === "china" || /^custom_[a-z0-9_]{1,48}$/.test(origin);
}

export interface ExchangeRates {
  USD: number;
  EUR: number;
  CNY: number;
  KRW: number;
}

export type ExchangeRateCode = keyof ExchangeRates;

/** KRW мелкий (~0.05–0.08 ₽), для него — 3 знака; остальные курсы — 2. */
export function exchangeRateDecimals(code?: ExchangeRateCode | CurrencyCode): number {
  return code === "KRW" ? 3 : 2;
}

/** Округление курса: KRW — 3 знака после запятой, остальные — 2. */
export function roundExchangeRate(
  value: number,
  code?: ExchangeRateCode | CurrencyCode,
): number {
  const factor = 10 ** exchangeRateDecimals(code);
  return Math.round(value * factor) / factor;
}

export function roundExchangeRates(rates: ExchangeRates): ExchangeRates {
  return {
    USD: roundExchangeRate(rates.USD, "USD"),
    EUR: roundExchangeRate(rates.EUR, "EUR"),
    CNY: roundExchangeRate(rates.CNY, "CNY"),
    KRW: roundExchangeRate(rates.KRW, "KRW"),
  };
}

/** Курсы по умолчанию (редактируются в UI). EUR нужен для расчёта пошлин. */
export const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  USD: 90,
  EUR: 98,
  CNY: 12.5,
  KRW: 0.07,
};

export const CUSTOMS_FEE_BRACKETS: Array<{ maxRub: number; fee: number }> = [
  { maxRub: 200_000, fee: 1_231 },
  { maxRub: 450_000, fee: 2_462 },
  { maxRub: 1_200_000, fee: 4_924 },
  { maxRub: 2_700_000, fee: 13_541 },
  { maxRub: 4_200_000, fee: 18_465 },
  { maxRub: 5_500_000, fee: 21_344 },
  { maxRub: 10_000_000, fee: 49_240 },
  { maxRub: Infinity, fee: 73_860 },
];

export const EXCISE_BRACKETS: Array<{ maxHp: number; ratePerHp: number }> = [
  { maxHp: 90, ratePerHp: 0 },
  { maxHp: 150, ratePerHp: 64 },
  { maxHp: 200, ratePerHp: 613 },
  { maxHp: 300, ratePerHp: 1004 },
  { maxHp: 400, ratePerHp: 1711 },
  { maxHp: 500, ratePerHp: 1771 },
  { maxHp: Infinity, ratePerHp: 1829 },
];

export const VAT_RATE = 0.2;

/** Базовая ставка для легковых (категория M1), руб. */
export const RECYCLING_BASE_PASSENGER = 20_000;

/**
 * Базовая ставка для грузовых/автобусов (не используется в калькуляторе легковушек).
 * Коэффициенты «коммерческого» УС для легковых умножаются на RECYCLING_BASE_PASSENGER.
 */
export const RECYCLING_BASE_COMMERCIAL = 150_000;

/** Порог льготного УС для физлица: мощность ДВС не выше 160 л.с. (117,68 кВт). */
export const PREFERENTIAL_MAX_HP_ICE = 160;
/** Порог льготного УС для физлица: 30-мин. мощность электро не выше 80 л.с. (58,84 кВт). */
export const PREFERENTIAL_MAX_HP_EV = 80;
/** Порог льготного УС: объём ДВС не более 3000 см³. */
export const PREFERENTIAL_MAX_VOLUME_CC = 3000;

/** @deprecated используйте RECYCLING_BASE_PASSENGER */
export const RECYCLING_BASE_PERSONAL = RECYCLING_BASE_PASSENGER;

/** 1 метрическая л.с. ≈ 0.73549875 кВт */
export function hpToKw(hp: number): number {
  return hp * 0.73549875;
}

export function isYoungerThan3(age: CarAge): boolean {
  return age === "new" || age === "under3";
}

/** Фиксированная стоимость доставки через Казахстан. */
export const KAZAKHSTAN_DELIVERY_USD = 1500;

/** Значения по умолчанию для расчёта из Кореи. */
export const DEFAULT_KOREA_PARKING_FEE_KRW = 440_000;
export const DEFAULT_KOREA_DOCS_DELIVERY_KRW = 1_800_000;
export const DEFAULT_KOREA_BROKER_FEE_RUB = 85_000;
export const DEFAULT_KOREA_DELIVERY_RUB = 200_000;

/** Доставка до города (Киргизия), USD. */
export const DEFAULT_KYRGYZSTAN_CITY_DELIVERY_USD = 1_500;
