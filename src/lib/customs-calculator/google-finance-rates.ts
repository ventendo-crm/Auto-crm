import { DEFAULT_EXCHANGE_RATES, ExchangeRates } from "@/lib/customs-calculator/rates";

const PAIRS = ["USD", "EUR", "CNY", "KRW"] as const;
type RateCode = (typeof PAIRS)[number];

const CACHE_TTL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;

type CacheEntry = {
  rates: ExchangeRates;
  fetchedAt: string;
  source: "google-finance" | "google-search" | "yahoo";
  expiresAt: number;
};

let cache: CacheEntry | null = null;

export type GoogleFinanceRatesResult = {
  rates: ExchangeRates;
  fetchedAt: string;
  source: "google-finance" | "google-search" | "yahoo";
  cached: boolean;
};

function roundRate(value: number): number {
  if (value >= 1) return Math.round(value * 10_000) / 10_000;
  return Math.round(value * 1_000_000) / 1_000_000;
}

function parseRateCandidate(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function extractRateFromFinanceHtml(html: string): number | null {
  const dataLastPrice = html.match(/data-last-price="([\d.,]+)"/i);
  const fromAttr = parseRateCandidate(dataLastPrice?.[1]);
  if (fromAttr) return fromAttr;

  const ymlkec = html.match(/class="[^"]*YMlKec[^"]*"[^>]*>\s*([\d.,]+)\s*</i);
  const fromClass = parseRateCandidate(ymlkec?.[1]);
  if (fromClass) return fromClass;

  const jsonPrice = html.match(/"price"\s*:\s*\{\s*"raw"\s*:\s*([\d.]+)/i);
  const fromJson = parseRateCandidate(jsonPrice?.[1]);
  if (fromJson) return fromJson;

  const generic = html.match(/data-exchange-rate="([\d.,]+)"/i);
  return parseRateCandidate(generic?.[1]);
}

function extractRateFromSearchHtml(html: string): number | null {
  const exchange = html.match(/data-exchange-rate="([\d.,]+)"/i);
  const fromAttr = parseRateCandidate(exchange?.[1]);
  if (fromAttr) return fromAttr;

  const knowledge = html.match(/knowledge-currency__tgt-amount[^>]*>\s*([\d\s.,]+)/i);
  return parseRateCandidate(knowledge?.[1]?.replace(/\s/g, ""));
}

async function fetchText(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml,application/json",
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPairFromGoogleFinance(code: RateCode): Promise<number | null> {
  const url = `https://www.google.com/finance/quote/${code}-RUB?hl=en&gl=us`;
  const { ok, status, text } = await fetchText(url);
  if (!ok) {
    if (status === 403 || text.includes("no longer support your region")) {
      throw new Error("GOOGLE_FINANCE_REGION_BLOCKED");
    }
    return null;
  }
  if (text.includes("no longer support your region")) {
    throw new Error("GOOGLE_FINANCE_REGION_BLOCKED");
  }
  return extractRateFromFinanceHtml(text);
}

async function fetchPairFromGoogleSearch(code: RateCode): Promise<number | null> {
  const url = `https://www.google.com/search?q=1+${code}+to+RUB&hl=en&gl=us`;
  const { ok, text } = await fetchText(url);
  if (!ok) return null;
  return extractRateFromSearchHtml(text);
}

async function fetchAllPairs(
  fetchOne: (code: RateCode) => Promise<number | null>,
): Promise<Partial<Record<RateCode, number>>> {
  const entries = await Promise.all(
    PAIRS.map(async (code) => {
      try {
        const rate = await fetchOne(code);
        return [code, rate] as const;
      } catch (error) {
        if (error instanceof Error && error.message === "GOOGLE_FINANCE_REGION_BLOCKED") {
          throw error;
        }
        return [code, null] as const;
      }
    }),
  );

  const result: Partial<Record<RateCode, number>> = {};
  for (const [code, rate] of entries) {
    if (rate != null) result[code] = roundRate(rate);
  }
  return result;
}

function toExchangeRates(partial: Partial<Record<RateCode, number>>): ExchangeRates | null {
  if (
    partial.USD == null ||
    partial.EUR == null ||
    partial.CNY == null ||
    partial.KRW == null
  ) {
    return null;
  }
  return {
    USD: partial.USD,
    EUR: partial.EUR,
    CNY: partial.CNY,
    KRW: partial.KRW,
  };
}

/**
 * Курсы валют к рублю с Google Finance.
 * При блокировке региона пробуем виджет конвертера Google Search (те же котировки Google).
 * Опционально: GOOGLE_FINANCE_RATES_URL — JSON { USD, EUR, CNY, KRW } (например Apps Script с GOOGLEFINANCE).
 */
export async function fetchGoogleFinanceRates(options?: {
  force?: boolean;
}): Promise<GoogleFinanceRatesResult> {
  const force = options?.force === true;
  const now = Date.now();

  if (!force && cache && cache.expiresAt > now) {
    return {
      rates: cache.rates,
      fetchedAt: cache.fetchedAt,
      source: cache.source,
      cached: true,
    };
  }

  const fromEnvUrl = await fetchFromConfiguredUrl();
  if (fromEnvUrl) {
    const fetchedAt = new Date().toISOString();
    cache = {
      rates: fromEnvUrl,
      fetchedAt,
      source: "google-finance",
      expiresAt: now + CACHE_TTL_MS,
    };
    return { rates: fromEnvUrl, fetchedAt, source: "google-finance", cached: false };
  }

  let financeError: Error | null = null;
  try {
    const fromFinance = toExchangeRates(await fetchAllPairs(fetchPairFromGoogleFinance));
    if (fromFinance) {
      const fetchedAt = new Date().toISOString();
      cache = {
        rates: fromFinance,
        fetchedAt,
        source: "google-finance",
        expiresAt: now + CACHE_TTL_MS,
      };
      return { rates: fromFinance, fetchedAt, source: "google-finance", cached: false };
    }
  } catch (error) {
    financeError = error instanceof Error ? error : new Error("Google Finance unavailable");
  }

  try {
    const fromSearch = toExchangeRates(await fetchAllPairs(fetchPairFromGoogleSearch));
    if (fromSearch) {
      const fetchedAt = new Date().toISOString();
      cache = {
        rates: fromSearch,
        fetchedAt,
        source: "google-search",
        expiresAt: now + CACHE_TTL_MS,
      };
      return { rates: fromSearch, fetchedAt, source: "google-search", cached: false };
    }
  } catch {
    // ignore, try Yahoo below
  }

  // Google Finance/Search часто блокируются в РФ — Yahoo использует те же рыночные FX-пары.
  const fromYahoo = await fetchRatesFromYahoo();
  if (fromYahoo) {
    const fetchedAt = new Date().toISOString();
    cache = {
      rates: fromYahoo,
      fetchedAt,
      source: "yahoo",
      expiresAt: now + CACHE_TTL_MS,
    };
    return { rates: fromYahoo, fetchedAt, source: "yahoo", cached: false };
  }

  if (financeError?.message === "GOOGLE_FINANCE_REGION_BLOCKED") {
    throw new Error(
      "Google Finance недоступен в регионе сервера, запасной источник тоже не ответил. Задайте курсы вручную.",
    );
  }

  throw new Error("Не удалось загрузить курсы. Попробуйте позже или задайте вручную.");
}

async function fetchYahooPair(symbol: string): Promise<number | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=1d&range=1d`;
  try {
    const { ok, text } = await fetchText(url);
    if (!ok) return null;
    const json = JSON.parse(text) as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
    };
    const price = json.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" && price > 0 ? price : null;
  } catch {
    return null;
  }
}

async function fetchRatesFromYahoo(): Promise<ExchangeRates | null> {
  const [usd, eur, cny, usdKrw] = await Promise.all([
    fetchYahooPair("USDRUB=X"),
    fetchYahooPair("EURRUB=X"),
    fetchYahooPair("CNYRUB=X"),
    fetchYahooPair("USDKRW=X"),
  ]);

  if (usd == null || eur == null || cny == null || usdKrw == null || usdKrw <= 0) {
    return null;
  }

  // KRW/RUB = (USD/RUB) / (USD/KRW)
  const krw = usd / usdKrw;

  return {
    USD: roundRate(usd),
    EUR: roundRate(eur),
    CNY: roundRate(cny),
    KRW: roundRate(krw),
  };
}

async function fetchFromConfiguredUrl(): Promise<ExchangeRates | null> {
  const url = process.env.GOOGLE_FINANCE_RATES_URL?.trim();
  if (!url) return null;

  try {
    const { ok, text } = await fetchText(url);
    if (!ok) return null;
    const parsed = JSON.parse(text) as Partial<ExchangeRates> & { rates?: Partial<ExchangeRates> };
    const raw = parsed.rates ?? parsed;
    const partial: Partial<Record<RateCode, number>> = {};
    for (const code of PAIRS) {
      const value = raw[code];
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        partial[code] = roundRate(value);
      }
    }
    return toExchangeRates(partial);
  } catch {
    return null;
  }
}

export function getDefaultExchangeRates(): ExchangeRates {
  return { ...DEFAULT_EXCHANGE_RATES };
}
