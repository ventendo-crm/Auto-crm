import { Agent, ProxyAgent, fetch as undiciFetch, type Dispatcher } from "undici";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

let cachedProxy: { url: string; agent: ProxyAgent } | null = null;
const directAgent = new Agent();

export function getOutboundProxyUrl(): string | null {
  const url =
    process.env.TELEGRAM_PROXY_URL?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    "";
  return url || null;
}

function getProxyAgent(): ProxyAgent | null {
  const url = getOutboundProxyUrl();
  if (!url) return null;
  if (!cachedProxy || cachedProxy.url !== url) {
    cachedProxy = { url, agent: new ProxyAgent(url) };
  }
  return cachedProxy.agent;
}

export type OutboundVia = "proxy" | "direct";

/** Сначала зарубежный HTTP-прокси (TELEGRAM_PROXY_URL), затем прямой выход. */
export function listOutboundDispatchers(): Array<{ via: OutboundVia; dispatcher: Dispatcher }> {
  const list: Array<{ via: OutboundVia; dispatcher: Dispatcher }> = [];
  const proxy = getProxyAgent();
  if (proxy) list.push({ via: "proxy", dispatcher: proxy });
  list.push({ via: "direct", dispatcher: directAgent });
  return list;
}

type OutboundInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
};

export async function outboundFetch(url: string, init: OutboundInit, dispatcher: Dispatcher) {
  return undiciFetch(url, {
    method: init.method ?? "GET",
    headers: {
      "User-Agent": DEFAULT_USER_AGENT,
      ...init.headers,
    },
    body: init.body,
    signal: init.signal,
    dispatcher,
  });
}
