export type TavilyQuickSearchResult = {
  answer: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
};

const TAVILY_TIMEOUT_MS = 20_000;

function firstSentence(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const match = cleaned.match(/^(.+?[.!?…])(?:\s|$)/u);
  if (match?.[1]) return match[1].trim();

  if (cleaned.length <= 220) return cleaned;
  return `${cleaned.slice(0, 217).trim()}…`;
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
    return "Превышено время ожидания ответа Tavily (20 с).";
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
    const hasProxy = Boolean(
      process.env.HTTPS_PROXY?.trim() ||
        process.env.HTTP_PROXY?.trim() ||
        process.env.TELEGRAM_PROXY_URL?.trim(),
    );
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

export async function searchWithTavily(query: string): Promise<TavilyQuickSearchResult> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    throw new TavilySearchError(
      "Быстрый поиск не настроен: добавьте TAVILY_API_KEY",
      "TAVILY_NOT_CONFIGURED",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TAVILY_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        include_answer: true,
        max_results: 3,
        topic: "general",
      }),
      signal: controller.signal,
    });
  } catch (error) {
    throw new TavilySearchError(describeNetworkError(error), "TAVILY_NETWORK");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const detail = parseTavilyErrorBody(body);
    console.error("Tavily search failed", response.status, body);

    if (response.status === 401 || response.status === 403) {
      throw new TavilySearchError(
        detail
          ? `Ключ Tavily отклонён: ${detail}`
          : "Ключ Tavily неверный или неактивен. Проверьте TAVILY_API_KEY в deploy/.env",
        "TAVILY_UNAUTHORIZED",
      );
    }

    if (response.status === 429) {
      throw new TavilySearchError(
        detail ?? "Превышен лимит запросов Tavily. Попробуйте позже.",
        "TAVILY_REQUEST_FAILED",
      );
    }

    throw new TavilySearchError(
      detail
        ? `Tavily вернул ошибку (${response.status}): ${detail}`
        : `Сервис поиска временно недоступен (${response.status})`,
      "TAVILY_REQUEST_FAILED",
    );
  }

  const data = (await response.json()) as {
    answer?: string;
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  const top = data.results?.[0];
  const rawAnswer =
    (typeof data.answer === "string" && data.answer.trim()) ||
    (typeof top?.content === "string" && top.content.trim()) ||
    "";

  if (!rawAnswer) {
    throw new TavilySearchError("Не удалось найти ответ по этому запросу", "TAVILY_EMPTY");
  }

  return {
    answer: firstSentence(rawAnswer),
    sourceUrl: typeof top?.url === "string" ? top.url : null,
    sourceTitle: typeof top?.title === "string" ? top.title : null,
  };
}
