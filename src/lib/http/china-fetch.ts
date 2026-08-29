const CHINA_FETCH_TIMEOUT_MS = 30_000;

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type Dispatcher = object;
type ProxyAgentCtor = new (uri: string) => Dispatcher;

let proxyAgentClassPromise: Promise<ProxyAgentCtor> | null = null;
let chinaProxyAgent: Dispatcher | null = null;
let chinaProxyAgentUrl: string | null = null;

async function loadProxyAgentClass(): Promise<ProxyAgentCtor> {
  if (!proxyAgentClassPromise) {
    proxyAgentClassPromise = import(/* webpackIgnore: true */ "undici").then(
      (mod) => mod.ProxyAgent as ProxyAgentCtor,
    );
  }
  return proxyAgentClassPromise;
}

export class ChinaFetchError extends Error {
  constructor(
    message: string,
    readonly code: "NETWORK" | "TIMEOUT" | "HTTP" | "ANTIBOT" | "EMPTY" | "NO_PROXY",
    readonly status?: number,
  ) {
    super(message);
    this.name = "ChinaFetchError";
  }
}

/** Прокси только для китайских сайтов (Che168 и CDN фото). */
export function getChinaProxyUrl(): string | null {
  const china = process.env.CHINA_PROXY_URL?.trim();
  if (china) return china;
  // Обратная совместимость, если отдельный прокси ещё не задан
  return process.env.TELEGRAM_PROXY_URL?.trim() || null;
}

async function getChinaFetchDispatcher(): Promise<Dispatcher | undefined> {
  const proxyUrl = getChinaProxyUrl();
  if (!proxyUrl) return undefined;
  if (!chinaProxyAgent || chinaProxyAgentUrl !== proxyUrl) {
    const ProxyAgent = await loadProxyAgentClass();
    chinaProxyAgent = new ProxyAgent(proxyUrl);
    chinaProxyAgentUrl = proxyUrl;
  }
  return chinaProxyAgent;
}

function getProxyHint(): string {
  const hasChina = Boolean(process.env.CHINA_PROXY_URL?.trim());
  const hasFallback = Boolean(process.env.TELEGRAM_PROXY_URL?.trim());
  if (hasChina) {
    return "Проверьте CHINA_PROXY_URL и доступность китайского прокси.";
  }
  if (hasFallback) {
    return "Задайте CHINA_PROXY_URL для Che168 или проверьте TELEGRAM_PROXY_URL (используется как запасной).";
  }
  return "На VPS добавьте в deploy/.env: CHINA_PROXY_URL=http://логин:пароль@хост:порт";
}

function describeNetworkError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  if (error.name === "AbortError") {
    return "Превышено время ожидания (30 с).";
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
    combined.includes("ENETUNREACH")
  ) {
    return `Сервер не может подключиться к сайту. ${getProxyHint()}`;
  }
  return combined || error.message;
}

function looksLikeAntibot(html: string): boolean {
  return /EO_Bot|__tst_status|TencentEdgeOne|captcha|challenge/i.test(html);
}

function looksLikeChe168Listing(html: string): boolean {
  return /og:image|万元|排量|车源|infophoto|autohome/i.test(html);
}

type ChinaFetchInit = RequestInit & { dispatcher?: Dispatcher };

async function chinaFetch(url: string, init: ChinaFetchInit = {}): Promise<Response> {
  const dispatcher = await getChinaFetchDispatcher();
  if (!dispatcher) {
    throw new ChinaFetchError(
      "Не задан CHINA_PROXY_URL для доступа к китайским сайтам.",
      "NO_PROXY",
    );
  }

  return fetch(url, {
    ...init,
    dispatcher,
  } as RequestInit);
}

export type ChinaFetchResult = {
  html: string;
  status: number;
  finalUrl: string;
};

export async function fetchChinaPage(url: string): Promise<ChinaFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHINA_FETCH_TIMEOUT_MS);

  try {
    const response = await chinaFetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });

    const html = await response.text();
    if (!response.ok) {
      throw new ChinaFetchError(
        `HTTP ${response.status} при загрузке страницы`,
        "HTTP",
        response.status,
      );
    }
    if (!html.trim()) {
      throw new ChinaFetchError("Пустой ответ от сервера", "EMPTY");
    }
    if (looksLikeAntibot(html)) {
      throw new ChinaFetchError(
        "Сайт вернул антибот-страницу (EdgeOne). Нужен рабочий китайский прокси или другой способ импорта.",
        "ANTIBOT",
        response.status,
      );
    }
    if (url.includes("che168.com") && !looksLikeChe168Listing(html)) {
      throw new ChinaFetchError(
        "Страница загружена, но не похожа на объявление Che168. Проверьте ссылку и прокси.",
        "EMPTY",
        response.status,
      );
    }

    return {
      html,
      status: response.status,
      finalUrl: response.url,
    };
  } catch (error) {
    if (error instanceof ChinaFetchError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ChinaFetchError("Превышено время ожидания (30 с).", "TIMEOUT");
    }
    throw new ChinaFetchError(describeNetworkError(error), "NETWORK");
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchChinaBinary(url: string): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHINA_FETCH_TIMEOUT_MS);

  try {
    const response = await chinaFetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": DEFAULT_USER_AGENT },
    });
    if (!response.ok) {
      throw new ChinaFetchError(`HTTP ${response.status}`, "HTTP", response.status);
    }
    return await response.arrayBuffer();
  } catch (error) {
    if (error instanceof ChinaFetchError) throw error;
    throw new ChinaFetchError(describeNetworkError(error), "NETWORK");
  } finally {
    clearTimeout(timeout);
  }
}
