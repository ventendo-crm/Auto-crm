import {
  defaultInputCurrencyForOrigin,
  type CustomCalculatorOrigin,
} from "@/lib/customs-calculator/custom-origins";
import {
  CurrencyCode,
  ExchangeRates,
  roundExchangeRate,
} from "@/lib/customs-calculator/rates";

export function exchangeRateCurrencyForOrigin(
  origin: string,
  customOrigins: CustomCalculatorOrigin[] = [],
): CurrencyCode {
  return defaultInputCurrencyForOrigin(origin, customOrigins);
}

export function exchangeRateLabelForOrigin(
  origin: string,
  customOrigins: CustomCalculatorOrigin[] = [],
): string {
  const currency = exchangeRateCurrencyForOrigin(origin, customOrigins);
  const labels: Record<CurrencyCode, string> = {
    CNY: "Курс юаня (CNY), ₽",
    KRW: "Курс воны (KRW), ₽",
    USD: "Курс доллара (USD), ₽",
    RUB: "Курс рубля, ₽",
  };
  return labels[currency];
}

export function applyDealExchangeRate(
  rates: ExchangeRates,
  originCountry: string,
  dealRate: number | null | undefined,
  customOrigins: CustomCalculatorOrigin[] = [],
): ExchangeRates {
  if (dealRate == null || !Number.isFinite(dealRate) || dealRate <= 0) {
    return rates;
  }

  const currency = exchangeRateCurrencyForOrigin(originCountry, customOrigins);
  return {
    ...rates,
    [currency]: roundExchangeRate(dealRate),
  };
}
