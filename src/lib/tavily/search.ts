import type { Dispatcher } from "undici";
import {
  getOutboundProxyUrl,
  listOutboundDispatchers,
  outboundFetch,
  type OutboundVia,
} from "@/lib/http/outbound-fetch";
import { assembleSpecSuggestion, specSummary } from "@/lib/spec-search/assemble";
import { searchWikipediaSpecs, type SpecDocument } from "@/lib/spec-search/wikipedia";
import {
  buildSpecRetrievalQuery,
  type QuickSearchSuggestion,
} from "@/lib/tavily/calculator-suggestion";

export type TavilyQuickSearchItem = {
  answer: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
};

export type TavilyQuickSearchResult = {
  summary: string;
  variants: TavilyQuickSearchItem[];
  suggestion: QuickSearchSuggestion | null;
};

const TAVILY_TIMEOUT_MS = 25_000;

const TAVILY_EXCLUDE_DOMAINS = [
  "pinterest.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "vk.com",
  "ok.ru",
  "alta.ru",
  "tks.ru",
  "consultant.ru",
  "garant.ru",
];

function firstSentence(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const match = cleaned.match(/^(.+?[.!?…])(?:\s|$)/u);
  if (match?.[1]) return match[1].trim();

  if (cleaned.length <= 220) return cleaned;
  return `${cleaned.slice(0, 217).trim()}…`;
}

function sanitizeTavilyApiKey(raw: string | undefined): string | null {
  if (!raw) return null;
  let key = raw.trim();
  // Часто копируют с кавычками или префиксом Bearer
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  if (key.toLowerCase().startsWith("bearer ")) {
    key = key.slice(7).trim();
  }
  return key || null;
}

function describeApiKey(key: string): string {
  if (key.length <= 12) return `длина ${key.length}`;
  return `начинается с «${key.slice(0, 8)}…», длина ${key.length}`;
}

function parseTavilyErrorBody(body: string): string | null {
  if (!body.trim()) return null;
  try {
    const parsed = JSON.parse(body) as {
      detail?: { error?: string } | string;
      error?: string;
      message?: string;
    };
    if (typeof parsed.detail === "string" && parsed.detail.trim()) return parsed.detail.trim();
    if (parsed.detail && typeof parsed.detail === "object" && parsed.detail.error) {
      return String(parsed.detail.error);
    }
    if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error.trim();
    if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message.trim();
  } catch {
    // ignore JSON parse errors
  }
  return body.slice(0, 200).trim() || null;
}

function describeNetworkError(error: unknown): string {
  if (!(error instanceof Error)) return "Не удалось подключиться к Tavily.";

  if (error.name === "AbortError") {
    return "Превышено время ожидания ответа Tavily (25 с).";
  }

  const cause = error.cause;
  const causeMessage =
    cause instanceof Error ? cause.message : cause !== undefined ? String(cause) : "";
  const combined = [error.message, causeMessage].filter(Boolean).join(": ");

  if (
    combined.includes("fetch failed") ||
    combined.includes("ECONNREFUSED") ||
    combined.includes("ENOTFOUND") ||
    combined.includes("ETIMEDOUT") ||
    combined.includes("EAI_AGAIN") ||
    combined.includes("ENETUNREACH") ||
    combined.includes("certificate") ||
    combined.includes("TLS")
  ) {
    const hasProxy = Boolean(getOutboundProxyUrl());
    return hasProxy
      ? "Сервер не может подключиться к Tavily через прокси. Проверьте HTTPS_PROXY / TELEGRAM_PROXY_URL."
      : "Сервер не может подключиться к api.tavily.com. На VPS в РФ обычно нужен HTTP-прокси (как для Telegram).";
  }

  return combined || error.message;
}

export class TavilySearchError extends Error {
  constructor(
    message: string,
    readonly code:
      | "TAVILY_NOT_CONFIGURED"
      | "TAVILY_UNAUTHORIZED"
      | "TAVILY_EMPTY"
      | "TAVILY_REQUEST_FAILED"
      | "TAVILY_NETWORK",
  ) {
    super(message);
    this.name = "TavilySearchError";
  }
}

function looksLikeHtmlBlock(status: number, body: string): boolean {
  if (status !== 401 && status !== 403) return false;
  return body.includes("<html") || body.includes("<HTML") || body.includes("403 Forbidden");
}

async function callTavilySearch(
  apiKey: string,
  query: string,
  mode: "bearer" | "body",
  dispatcher: Dispatcher,
  signal: AbortSignal,
): Promise<{ status: number; ok: boolean; body: string }> {
  const retrievalQuery = buildSpecRetrievalQuery(query);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const payload: Record<string, unknown> = {
    query: retrievalQuery,
    search_depth: "basic",
    include_answer: false,
    include_raw_content: true,
    max_results: 8,
    topic: "general",
    exclude_domains: TAVILY_EXCLUDE_DOMAINS,
  };

  if (mode === "bearer") {
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    payload.api_key = apiKey;
  }

  const response = await outboundFetch(
    "https://api.tavily.com/search",
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal,
    },
    dispatcher,
  );
  const body = await response.text();
  return { status: response.status, ok: response.ok, body };
}

function throwFromTavilyHttp(status: number, body: string, apiKey: string): never {
  const detail = parseTavilyErrorBody(body);
  console.error("Tavily search failed", status, body, describeApiKey(apiKey));

  if (status === 401 || status === 403) {
    throw new TavilySearchError(
      [
        "Ключ Tavily отклонён.",
        detail ? `Ответ API: ${detail}.` : null,
        `Проверьте ключ в контейнере (${describeApiKey(apiKey)}).`,
        "В deploy/.env должна быть строка без кавычек: TAVILY_API_KEY=tvly-…",
        "После правки: docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --force-recreate app",
      ]
        .filter(Boolean)
        .join(" "),
      "TAVILY_UNAUTHORIZED",
    );
  }

  if (status === 429) {
    throw new TavilySearchError(
      detail ?? "Превышен лимит запросов Tavily. Попробуйте позже.",
      "TAVILY_REQUEST_FAILED",
    );
  }

  throw new TavilySearchError(
    detail ? `Tavily вернул ошибку (${status}): ${detail}` : `Сервис поиска временно недоступен (${status})`,
    "TAVILY_REQUEST_FAILED",
  );
}

function parseTavilyDocuments(body: string): SpecDocument[] {
  const data = JSON.parse(body) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      raw_content?: string;
    }>;
  };

  return (data.results ?? [])
    .slice(0, 8)
    .map((item) => {
      const raw =
        (typeof item.raw_content === "string" && item.raw_content.trim()) ||
        (typeof item.content === "string" && item.content.trim()) ||
        "";
      if (!raw) return null;
      return {
        text: raw.slice(0, 8_000),
        title: typeof item.title === "string" ? item.title : null,
        url: typeof item.url === "string" ? item.url : null,
      } satisfies SpecDocument;
    })
    .filter((item): item is SpecDocument => item !== null);
}

function toSearchResult(docs: SpecDocument[], userQuery: string): TavilyQuickSearchResult {
  if (docs.length === 0) {
    throw new TavilySearchError("Не удалось найти спецификации по этому запросу", "TAVILY_EMPTY");
  }

  const suggestion = assembleSpecSuggestion(docs, userQuery);
  const variants = docs.slice(0, 5).map((item) => ({
    answer: firstSentence(item.text),
    sourceUrl: item.url,
    sourceTitle: item.title,
  }));

  return {
    summary: specSummary(suggestion, variants[0]?.answer ?? ""),
    variants,
    suggestion,
  };
}

function htmlBlockMessage(via: OutboundVia): string {
  if (via === "proxy" || getOutboundProxyUrl()) {
    return "Tavily недоступен через текущий прокси (HTTP 403). Нужен обычный HTTP-прокси за рубежом в TELEGRAM_PROXY_URL, не только для api.telegram.org.";
  }
  return "Tavily недоступен с этого сервера (HTTP 403, блок по региону/IP). Добавьте в deploy/.env HTTP-прокси: TELEGRAM_PROXY_URL=http://user:pass@host:port и пересоздайте app.";
}

export async function searchWithTavily(query: string): Promise<TavilyQuickSearchResult> {
  const apiKey = sanitizeTavilyApiKey(process.env.TAVILY_API_KEY);
  if (!apiKey) {
    throw new TavilySearchError(
      "Быстрый поиск не настроен: добавьте TAVILY_API_KEY в deploy/.env и пересоздайте контейнер app",
      "TAVILY_NOT_CONFIGURED",
    );
  }

  if (!apiKey.startsWith("tvly-") && !apiKey.startsWith("tvly-dev-")) {
    throw new TavilySearchError(
      `Похоже, в TAVILY_API_KEY не ключ Tavily (${describeApiKey(apiKey)}). Ожидается значение вида tvly-… из https://app.tavily.com`,
      "TAVILY_UNAUTHORIZED",
    );
  }

  const wikiPromise = searchWikipediaSpecs(query).catch(() => [] as SpecDocument[]);

  const dispatchers = listOutboundDispatchers();
  let lastHtmlVia: OutboundVia | null = null;
  let lastNetworkError: unknown = null;

  for (const { via, dispatcher } of dispatchers) {
    for (const mode of ["bearer", "body"] as const) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TAVILY_TIMEOUT_MS);
      try {
        const response = await callTavilySearch(apiKey, query, mode, dispatcher, controller.signal);
        if (response.ok) {
          try {
            const tavilyDocs = parseTavilyDocuments(response.body);
            const wikiDocs = await wikiPromise;
            return toSearchResult([...tavilyDocs, ...wikiDocs], query);
          } catch (error) {
            if (error instanceof TavilySearchError) throw error;
            throw new TavilySearchError("Tavily вернул некорректный ответ", "TAVILY_REQUEST_FAILED");
          }
        }

        if (looksLikeHtmlBlock(response.status, response.body)) {
          console.error("Tavily HTML 403", via, mode, response.body.slice(0, 300));
          lastHtmlVia = via;
          break;
        }

        if ((response.status === 401 || response.status === 403) && mode === "bearer") {
          console.error("Tavily bearer auth failed, retrying with api_key body", via, response.status);
          continue;
        }

        throwFromTavilyHttp(response.status, response.body, apiKey);
      } catch (error) {
        if (error instanceof TavilySearchError) throw error;
        lastNetworkError = error;
        console.error("Tavily network error", via, mode, error);
        break;
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  const wikiDocs = await wikiPromise;
  if (wikiDocs.length > 0) {
    return toSearchResult(wikiDocs, query);
  }

  if (lastNetworkError) {
    throw new TavilySearchError(describeNetworkError(lastNetworkError), "TAVILY_NETWORK");
  }

  throw new TavilySearchError(htmlBlockMessage(lastHtmlVia ?? "direct"), "TAVILY_NETWORK");
}
