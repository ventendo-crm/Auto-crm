import { listOutboundDispatchers, outboundFetch } from "@/lib/http/outbound-fetch";

export type SpecDocument = {
  text: string;
  title: string | null;
  url: string | null;
};

type WikiSearchResponse = {
  query?: {
    search?: Array<{ title?: string }>;
  };
};

type WikiExtractResponse = {
  query?: {
    pages?: Record<string, { title?: string; extract?: string; missing?: string }>;
  };
};

async function fetchJson(url: string): Promise<unknown | null> {
  for (const { dispatcher } of listOutboundDispatchers()) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await outboundFetch(
        url,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        },
        dispatcher,
      );
      if (!response.ok) continue;
      return JSON.parse(await response.text()) as unknown;
    } catch {
      // try next dispatcher
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

async function readWikipedia(lang: string, query: string): Promise<SpecDocument | null> {
  const searchUrl =
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=search` +
    `&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`;
  const search = (await fetchJson(searchUrl)) as WikiSearchResponse | null;
  const title = search?.query?.search?.[0]?.title?.trim();
  if (!title) return null;

  const extractUrl =
    `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts` +
    `&exintro=1&explaintext=1&redirects=1&format=json&origin=*` +
    `&titles=${encodeURIComponent(title)}`;
  const extracted = (await fetchJson(extractUrl)) as WikiExtractResponse | null;
  const page = Object.values(extracted?.query?.pages ?? {})[0];
  const text = page?.extract?.trim();
  if (!text || page?.missing != null) return null;

  return {
    title: page.title ?? title,
    text: text.slice(0, 8_000),
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent((page.title ?? title).replace(/ /g, "_"))}`,
  };
}

export async function searchWikipediaSpecs(model: string): Promise<SpecDocument[]> {
  const query = model.trim();
  if (query.length < 3) return [];

  const pages = await Promise.allSettled([
    readWikipedia("en", query),
    readWikipedia("zh", query),
    readWikipedia("ru", query),
  ]);

  return pages
    .map((item) => (item.status === "fulfilled" ? item.value : null))
    .filter((item): item is SpecDocument => item != null);
}
