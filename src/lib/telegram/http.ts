const TELEGRAM_TIMEOUT_MS = 15_000;

function getTelegramApiBaseUrl(): string {
  return (process.env.TELEGRAM_API_BASE_URL ?? "https://api.telegram.org").replace(/\/$/, "");
}

export function buildTelegramApiUrl(token: string, method: string): string {
  return `${getTelegramApiBaseUrl()}/bot${token}/${method}`;
}

export function describeTelegramFetchError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  if (error.name === "AbortError") {
    return "Превышено время ожидания ответа Telegram (15 с).";
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
    const proxyHint = process.env.TELEGRAM_PROXY_URL?.trim()
      ? "Проверьте TELEGRAM_PROXY_URL и доступность прокси с сервера."
      : "На VPS в РФ добавьте HTTP-прокси в deploy/.env: TELEGRAM_PROXY_URL=http://хост:порт, перезапустите app.";

    return [
      "Сервер не может подключиться к Telegram API.",
      causeMessage ? `Причина: ${causeMessage}` : "",
      proxyHint,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return combined || error.message;
}

export async function callTelegramApi<T = unknown>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  const url = buildTelegramApiUrl(token, method);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const data = (await response.json()) as {
      ok: boolean;
      description?: string;
      result?: T;
    };

    if (!data.ok) {
      return { ok: false, error: data.description ?? `Ошибка Telegram API (${method})` };
    }

    return { ok: true, result: data.result as T };
  } catch (error) {
    return { ok: false, error: describeTelegramFetchError(error) };
  } finally {
    clearTimeout(timeout);
  }
}
