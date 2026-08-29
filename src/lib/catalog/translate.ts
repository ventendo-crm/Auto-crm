import { fetchChinaPage, getChinaProxyUrl } from "@/lib/http/china-fetch";

const TRANSLATE_TIMEOUT_MS = 15_000;

function chunkText(text: string, maxLen = 450): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxLen) return [cleaned];

  const chunks: string[] = [];
  let rest = cleaned;
  while (rest.length > maxLen) {
    const slice = rest.slice(0, maxLen);
    const breakAt = Math.max(slice.lastIndexOf("。"), slice.lastIndexOf(". "), slice.lastIndexOf(" "));
    const cut = breakAt > 80 ? breakAt + 1 : maxLen;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function translateChunk(text: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSLATE_TIMEOUT_MS);
  try {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", text);
    url.searchParams.set("langpair", "zh|ru");

    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      responseData?: { translatedText?: string };
    };
    const translated = data.responseData?.translatedText?.trim();
    return translated || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function translateZhToRu(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const chunks = chunkText(trimmed);
  const parts: string[] = [];
  for (const chunk of chunks) {
    const translated = await translateChunk(chunk);
    parts.push(translated ?? chunk);
  }
  return parts.join(" ").trim();
}

export async function translateCatalogFields(fields: {
  titleZh: string;
  descriptionZh: string;
}): Promise<{ titleRu: string; descriptionRu: string }> {
  const [titleRu, descriptionRu] = await Promise.all([
    translateZhToRu(fields.titleZh),
    fields.descriptionZh ? translateZhToRu(fields.descriptionZh) : Promise.resolve(""),
  ]);
  return { titleRu, descriptionRu };
}

export async function checkChinaProxyHealth(): Promise<{
  ok: boolean;
  message: string;
  proxy: "CHINA_PROXY_URL" | "TELEGRAM_PROXY_URL" | "none";
}> {
  const proxyUrl = getChinaProxyUrl();
  if (!proxyUrl) {
    return {
      ok: false,
      message: "Не задан CHINA_PROXY_URL для доступа к Che168.",
      proxy: "none",
    };
  }
  const proxy = process.env.CHINA_PROXY_URL?.trim() ? "CHINA_PROXY_URL" : "TELEGRAM_PROXY_URL";

  try {
    await fetchChinaPage("https://www.che168.com/");
    return {
      ok: true,
      message: `Прокси (${proxy}) и доступ к Che168 работают.`,
      proxy,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message, proxy };
  }
}
