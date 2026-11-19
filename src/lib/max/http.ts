const MAX_TIMEOUT_MS = 15_000;

function getMaxApiBaseUrl(): string {
  const configured = process.env.MAX_API_BASE_URL?.trim();
  return (configured || "https://platform-api2.max.ru").replace(/\/$/, "");
}

function buildMaxUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const url = new URL(`${getMaxApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export function describeMaxFetchError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  if (error.name === "AbortError") {
    return "Превышено время ожидания ответа MAX (15 с).";
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
    combined.includes("certificate") ||
    combined.includes("TLS")
  ) {
    return [
      "Сервер не может подключиться к MAX API (platform-api2.max.ru).",
      causeMessage ? `Причина: ${causeMessage}` : "",
      "Проверьте интернет на VPS. Для MAX зарубежный TELEGRAM_PROXY_URL обычно не нужен.",
    ]
      .filter(Boolean)
      .join(" ");
  }
  return combined || error.message;
}

function readMaxError(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const message =
      (typeof record.message === "string" && record.message) ||
      (typeof record.error === "string" && record.error) ||
      (typeof record.code === "string" && record.code);
    if (message) return message;
  }
  return `Ошибка MAX API (${status})`;
}

export async function callMaxApi<T = unknown>(params: {
  token: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}): Promise<{ ok: true; data: T } | { ok: false; error: string; status?: number }> {
  const url = buildMaxUrl(params.path, params.query);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAX_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: params.method,
      headers: {
        Authorization: params.token,
        ...(params.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: params.body !== undefined ? JSON.stringify(params.body) : undefined,
      signal: controller.signal,
    });

    const raw = await response.text();
    let data: unknown = null;
    if (raw) {
      try {
        data = JSON.parse(raw) as unknown;
      } catch {
        data = { message: raw.slice(0, 300) };
      }
    }

    if (!response.ok) {
      return { ok: false, error: readMaxError(data, response.status), status: response.status };
    }

    return { ok: true, data: data as T };
  } catch (error) {
    return { ok: false, error: describeMaxFetchError(error) };
  } finally {
    clearTimeout(timeout);
  }
}
