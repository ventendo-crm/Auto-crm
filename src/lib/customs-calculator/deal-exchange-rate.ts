import {
  CurrencyCode,
  ExchangeRates,
  isChinaLikeOrigin,
  isKoreaOrigin,
  isKyrgyzstanOrigin,
  roundExchangeRate,
} from "@/lib/customs-calculator/rates";

export function exchangeRateCurrencyForOrigin(origin: string): CurrencyCode {
  if (isKoreaOrigin(origin)) return "KRW";
  if (isKyrgyzstanOrigin(origin)) return "USD";
  if (isChinaLikeOrigin(origin)) return "CNY";
  return "CNY";
}

export function exchangeRateLabelForOrigin(origin: string): string {
  const currency = exchangeRateCurrencyForOrigin(origin);
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
): ExchangeRates {
  if (dealRate == null || !Number.isFinite(dealRate) || dealRate <= 0) {
    return rates;
  }

  const currency = exchangeRateCurrencyForOrigin(originCountry);
  return {
    ...rates,
    [currency]: roundExchangeRate(dealRate),
  };
}
