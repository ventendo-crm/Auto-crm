export type TavilyQuickSearchResult = {
  answer: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
};

function firstSentence(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const match = cleaned.match(/^(.+?[.!?…])(?:\s|$)/u);
  if (match?.[1]) return match[1].trim();

  if (cleaned.length <= 220) return cleaned;
  return `${cleaned.slice(0, 217).trim()}…`;
}

export async function searchWithTavily(query: string): Promise<TavilyQuickSearchResult> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("TAVILY_NOT_CONFIGURED");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      include_answer: "basic",
      max_results: 3,
      topic: "general",
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("Tavily search failed", response.status, body);
    throw new Error("TAVILY_REQUEST_FAILED");
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
    throw new Error("TAVILY_EMPTY");
  }

  return {
    answer: firstSentence(rawAnswer),
    sourceUrl: typeof top?.url === "string" ? top.url : null,
    sourceTitle: typeof top?.title === "string" ? top.title : null,
  };
}
