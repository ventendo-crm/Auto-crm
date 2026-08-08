import { randomBytes } from "crypto";
import {
  CurrencyCode,
  DEFAULT_KOREA_BROKER_FEE_RUB,
  DEFAULT_KOREA_DELIVERY_RUB,
  DEFAULT_KOREA_DOCS_DELIVERY_KRW,
  DEFAULT_KOREA_PARKING_FEE_KRW,
  DEFAULT_KYRGYZSTAN_CITY_DELIVERY_USD,
  KAZAKHSTAN_DELIVERY_USD,
  OriginCountry,
} from "@/lib/customs-calculator/rates";

/** Defaults mirrored from calculate.ts to avoid circular imports. */
const DEFAULT_BROKER_FEE_RUB = 55_000;
const DEFAULT_DELIVERY_RUB = 200_000;
const DEFAULT_ESCORT_RUB = 200_000;
export const CALCULATOR_EXPENSE_ROLES = [
  "china_local",
  "city_delivery",
  "korea_parking",
  "korea_docs",
  "broker",
  "delivery",
  "delivery_usd",
  "escort",
  "extra",
] as const;

export type CalculatorExpenseRole = (typeof CALCULATOR_EXPENSE_ROLES)[number];

export const CALCULATOR_EXPENSE_ORIGINS = ["all", "china", "korea", "kyrgyzstan"] as const;
/** Системный origin или кастомный id компании (`custom_...`). */
export type CalculatorExpenseOrigin = (typeof CALCULATOR_EXPENSE_ORIGINS)[number] | (string & {});

export const CALCULATOR_EXPENSE_CURRENCIES: CurrencyCode[] = ["RUB", "USD", "CNY", "KRW"];

export interface CalculatorExpenseItem {
  id: string;
  label: string;
  defaultAmount: number;
  currency: CurrencyCode;
  origin: CalculatorExpenseOrigin;
  role: CalculatorExpenseRole;
  sortOrder: number;
}

export function createExpenseItemId(): string {
  return `exp_${randomBytes(8).toString("hex")}`;
}

export function getDefaultCompanyCalculatorExpenses(): CalculatorExpenseItem[] {
  return [
    {
      id: "sys-china-local",
      label: "Расходы по Китаю",
      defaultAmount: 5000,
      currency: "CNY",
      origin: "china",
      role: "china_local",
      sortOrder: 10,
    },
    {
      id: "sys-kyrgyzstan-city-delivery",
      label: "Доставка до города",
      defaultAmount: DEFAULT_KYRGYZSTAN_CITY_DELIVERY_USD,
      currency: "USD",
      origin: "kyrgyzstan",
      role: "city_delivery",
      sortOrder: 15,
    },
    {
      id: "sys-korea-parking",
      label: "Комиссия стоянки",
      defaultAmount: DEFAULT_KOREA_PARKING_FEE_KRW,
      currency: "KRW",
      origin: "korea",
      role: "korea_parking",
      sortOrder: 20,
    },
    {
      id: "sys-korea-docs",
      label: "Документы и доставка до РФ",
      defaultAmount: DEFAULT_KOREA_DOCS_DELIVERY_KRW,
      currency: "KRW",
      origin: "korea",
      role: "korea_docs",
      sortOrder: 30,
    },
    {
      id: "sys-broker-china",
      label: "Услуги брокера",
      defaultAmount: DEFAULT_BROKER_FEE_RUB,
      currency: "RUB",
      origin: "china",
      role: "broker",
      sortOrder: 40,
    },
    {
      id: "sys-broker-korea",
      label: "Услуги брокера",
      defaultAmount: DEFAULT_KOREA_BROKER_FEE_RUB,
      currency: "RUB",
      origin: "korea",
      role: "broker",
      sortOrder: 41,
    },
    {
      id: "sys-broker-kyrgyzstan",
      label: "Услуги брокера",
      defaultAmount: DEFAULT_BROKER_FEE_RUB,
      currency: "RUB",
      origin: "kyrgyzstan",
      role: "broker",
      sortOrder: 42,
    },
    {
      id: "sys-delivery-china",
      label: "Доставка по РФ",
      defaultAmount: DEFAULT_DELIVERY_RUB,
      currency: "RUB",
      origin: "china",
      role: "delivery",
      sortOrder: 50,
    },
    {
      id: "sys-delivery-korea",
      label: "Доставка из Владивостока",
      defaultAmount: DEFAULT_KOREA_DELIVERY_RUB,
      currency: "RUB",
      origin: "korea",
      role: "delivery",
      sortOrder: 51,
    },
    {
      id: "sys-delivery-usd",
      label: "Доставка через Казахстан",
      defaultAmount: KAZAKHSTAN_DELIVERY_USD,
      currency: "USD",
      origin: "china",
      role: "delivery_usd",
      sortOrder: 52,
    },
    {
      id: "sys-escort",
      label: "Услуги сопровождения",
      defaultAmount: DEFAULT_ESCORT_RUB,
      currency: "RUB",
      origin: "all",
      role: "escort",
      sortOrder: 60,
    },
  ];
}

export function expenseMatchesOrigin(
  item: CalculatorExpenseItem,
  origin: OriginCountry,
): boolean {
  return item.origin === "all" || item.origin === origin;
}

export function findExpenseByRole(
  items: CalculatorExpenseItem[],
  role: CalculatorExpenseRole,
  origin: OriginCountry,
): CalculatorExpenseItem | undefined {
  const scoped = items
    .filter((item) => item.role === role && expenseMatchesOrigin(item, origin))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Prefer origin-specific over "all"
  return scoped.find((item) => item.origin === origin) ?? scoped[0];
}

export function listExtraExpenses(
  items: CalculatorExpenseItem[],
  origin: OriginCountry,
): CalculatorExpenseItem[] {
  return items
    .filter((item) => item.role === "extra" && expenseMatchesOrigin(item, origin))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function sortExpenseItems(items: CalculatorExpenseItem[]): CalculatorExpenseItem[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "ru"));
}

export const EXPENSE_ROLE_LABELS: Record<CalculatorExpenseRole, string> = {
  china_local: "Расходы по Китаю (в 1-й платёж)",
  city_delivery: "Доставка до города (Киргизия, в 1-й платёж)",
  korea_parking: "Стоянка (Корея, в 1-й платёж)",
  korea_docs: "Документы/доставка до РФ (Корея)",
  broker: "Брокер",
  delivery: "Доставка, ₽",
  delivery_usd: "Доставка через Казахстан, USD",
  escort: "Сопровождение",
  extra: "Доп. расход (в итог)",
};

export const EXPENSE_ORIGIN_LABELS: Record<string, string> = {
  all: "Все страны",
  china: "Только Китай",
  korea: "Только Корея",
  kyrgyzstan: "Только Киргизия",
};
