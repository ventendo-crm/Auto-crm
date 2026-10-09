import {
  extractSpecsFromDocument,
  resolveUtilPower,
  titleFromUserQuery,
  withHybridNote,
  type HybridLayout,
  type QuickSearchEngineKind,
  type QuickSearchSuggestion,
} from "@/lib/tavily/calculator-suggestion";
import type { SpecDocument } from "@/lib/spec-search/wikipedia";

export type SpecTrimCandidate = {
  id: string;
  label: string;
  suggestion: QuickSearchSuggestion;
  sourceUrl: string | null;
  sourceTitle: string | null;
};

function hostWeight(url: string | null): number {
  if (!url) return 1;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("autohome") || host.includes("carnewschina")) return 4;
    if (host.includes("wikipedia")) return 3;
    if (host.includes("drom.ru") || host.endsWith("auto.ru")) return 2;
    if (
      host.includes("gac") ||
      host.includes("byd") ||
      host.includes("zeekr") ||
      host.includes("hyundai") ||
      host.includes("kia.") ||
      host.includes("changan")
    ) {
      return 4;
    }
  } catch {
    return 1;
  }
  return 1;
}

function isFeeLikeVolume(cc: number): boolean {
  return cc === 1000 || cc === 2000 || cc === 3000 || cc === 4000;
}

function pickVoted<T extends string | number>(
  votes: Array<{ value: T; weight: number }>,
): T | null {
  if (votes.length === 0) return null;
  const scores = new Map<T, number>();
  for (const vote of votes) {
    scores.set(vote.value, (scores.get(vote.value) ?? 0) + vote.weight);
  }
  let best: T | null = null;
  let bestScore = -1;
  for (const [value, score] of scores) {
    if (score > bestScore) {
      best = value;
      bestScore = score;
    }
  }
  return best;
}

function queryTokens(query: string): string[] {
  return (query.toLowerCase().match(/[a-zа-яё0-9+]{2,}/gi) ?? []).filter((token) => token.length >= 2);
}

function modelRelevance(text: string, query: string): number {
  const hay = text.toLowerCase();
  return queryTokens(query).reduce((score, token) => score + (hay.includes(token) ? 1 : 0), 0);
}

type ExtractedDoc = {
  doc: SpecDocument;
  specs: Partial<QuickSearchSuggestion>;
  weight: number;
  relevance: number;
};

function buildSuggestionFromGroup(
  group: ExtractedDoc[],
  userQuery: string,
): QuickSearchSuggestion | null {
  const volumeVotes = group.flatMap((item) =>
    item.specs.volumeCc
      ? [
          {
            value: item.specs.volumeCc,
            weight: item.weight * (isFeeLikeVolume(item.specs.volumeCc) ? 0.35 : 1),
          },
        ]
      : [],
  );
  const icePowerVotes = group.flatMap((item) =>
    item.specs.icePowerHp ? [{ value: item.specs.icePowerHp, weight: item.weight }] : [],
  );
  const electricPowerVotes = group.flatMap((item) =>
    item.specs.electricPowerHp
      ? [{ value: item.specs.electricPowerHp, weight: item.weight }]
      : [],
  );
  const kindVotes = group.flatMap((item) =>
    item.specs.engineKind ? [{ value: item.specs.engineKind, weight: item.weight }] : [],
  );
  const layoutVotes = group.flatMap((item) =>
    item.specs.hybridLayout ? [{ value: item.specs.hybridLayout, weight: item.weight }] : [],
  );
  const originVotes = group.flatMap((item) =>
    item.specs.originCountry
      ? [{ value: item.specs.originCountry, weight: item.weight }]
      : [],
  );

  const engineKind = (pickVoted(kindVotes) as QuickSearchEngineKind | null) ?? null;
  const isElectric = engineKind === "electric";
  const hybridLayout = isElectric
    ? null
    : ((pickVoted(layoutVotes) as HybridLayout | null) ?? null);
  const volumeCc = isElectric ? null : pickVoted(volumeVotes);
  const icePowerHp = isElectric ? null : pickVoted(icePowerVotes);
  const electricPowerHp = pickVoted(electricPowerVotes);
  const resolved = resolveUtilPower({
    engineKind,
    layout: hybridLayout,
    icePowerHp,
    electricPowerHp,
  });
  const originCountry = pickVoted(originVotes);
  const title =
    group.find((item) => item.specs.title)?.specs.title ?? titleFromUserQuery(userQuery);
  const engine = isElectric
    ? "electric"
    : volumeCc || engineKind === "hybrid" || engineKind === "phev" || engineKind === "ice"
      ? "petrol"
      : null;
  const age = group.find((item) => item.specs.age)?.specs.age ?? null;

  if (!engine && !resolved.powerHp && !volumeCc && !title) return null;

  return withHybridNote({
    title,
    originCountry: originCountry ?? null,
    engineKind,
    hybridLayout,
    engine,
    powerHp: resolved.powerHp,
    icePowerHp,
    electricPowerHp,
    volumeCc: engine === "electric" ? null : volumeCc,
    price: null,
    currency: null,
    age,
    importer: null,
    note: resolved.note,
  });
}

function trimFingerprint(suggestion: QuickSearchSuggestion): string {
  return [
    suggestion.engineKind ?? "unknown",
    suggestion.hybridLayout ?? "-",
    suggestion.volumeCc ?? "-",
    suggestion.icePowerHp ?? "-",
    suggestion.electricPowerHp ?? "-",
  ].join("|");
}

function trimLabel(suggestion: QuickSearchSuggestion): string {
  const parts: string[] = [];
  if (suggestion.engineKind === "electric") parts.push("электро");
  else if (suggestion.engineKind === "phev") parts.push("подключаемый гибрид");
  else if (suggestion.engineKind === "hybrid") parts.push("гибрид");
  else if (suggestion.engineKind === "ice") parts.push("ДВС");
  if (suggestion.hybridLayout === "parallel") parts.push("параллельный");
  if (suggestion.hybridLayout === "series") parts.push("последовательный");
  if (suggestion.volumeCc) {
    const liters = (suggestion.volumeCc / 1000).toFixed(1).replace(".0", "");
    parts.push(`${liters} л`);
  }
  if (suggestion.powerHp) parts.push(`${suggestion.powerHp} л.с.`);
  return parts.join(" · ") || suggestion.title || "Комплектация";
}

export function listTrimCandidates(
  docs: SpecDocument[],
  userQuery: string,
): SpecTrimCandidate[] {
  const extracted = docs.map((doc) => {
    const blob = [doc.title, doc.text].filter(Boolean).join("\n");
    return {
      doc,
      specs: extractSpecsFromDocument(blob),
      weight: hostWeight(doc.url),
      relevance: modelRelevance(blob, userQuery),
    } satisfies ExtractedDoc;
  });

  const bestRelevance = extracted.reduce((max, item) => Math.max(max, item.relevance), 0);
  const focused =
    bestRelevance > 0
      ? extracted.filter((item) => item.relevance >= Math.max(1, bestRelevance - 1))
      : extracted;

  const byKind = new Map<string, ExtractedDoc[]>();
  for (const item of focused) {
    const key = [
      item.specs.engineKind ?? "unknown",
      item.specs.hybridLayout ?? "-",
      item.specs.volumeCc ?? "-",
    ].join("|");
    const list = byKind.get(key) ?? [];
    list.push(item);
    byKind.set(key, list);
  }

  const candidates: SpecTrimCandidate[] = [];
  for (const group of byKind.values()) {
    const suggestion = buildSuggestionFromGroup(group, userQuery);
    if (!suggestion) continue;
    const bestDoc = [...group].sort(
      (a, b) => b.relevance - a.relevance || b.weight - a.weight,
    )[0];
    candidates.push({
      id: trimFingerprint(suggestion),
      label: trimLabel(suggestion),
      suggestion,
      sourceUrl: bestDoc?.doc.url ?? null,
      sourceTitle: bestDoc?.doc.title ?? null,
    });
  }

  return candidates
    .sort((a, b) => {
      const score = (item: SpecTrimCandidate) => {
        let value = 0;
        if (item.suggestion.engineKind) value += 2;
        if (item.suggestion.powerHp) value += 2;
        if (item.suggestion.volumeCc || item.suggestion.engine === "electric") value += 1;
        if (item.suggestion.hybridLayout) value += 1;
        return value;
      };
      return score(b) - score(a);
    })
    .slice(0, 3);
}

export function assembleSpecSuggestion(
  docs: SpecDocument[],
  userQuery: string,
): QuickSearchSuggestion | null {
  return listTrimCandidates(docs, userQuery)[0]?.suggestion ?? null;
}

export function specSummary(suggestion: QuickSearchSuggestion | null, fallback: string): string {
  if (!suggestion) return fallback;
  const parts = [suggestion.title].filter(Boolean) as string[];
  if (suggestion.engineKind === "phev") parts.push("подключаемый гибрид");
  else if (suggestion.engineKind === "hybrid") parts.push("гибрид");
  else if (suggestion.engineKind === "electric") parts.push("электро");
  if (suggestion.volumeCc) {
    const liters = (suggestion.volumeCc / 1000).toFixed(1).replace(".0", "");
    parts.push(`ДВС ${liters} л`);
  }
  if (suggestion.hybridLayout === "parallel" && suggestion.icePowerHp && suggestion.electricPowerHp) {
    parts.push(
      `параллельный: ${suggestion.icePowerHp} + ${suggestion.electricPowerHp} = ${suggestion.powerHp} л.с.`,
    );
  } else if (suggestion.hybridLayout === "series" && suggestion.powerHp) {
    parts.push(`последовательный: ${suggestion.powerHp} л.с. (30-мин.)`);
  } else if (suggestion.powerHp) {
    parts.push(
      suggestion.engine === "electric"
        ? `${suggestion.powerHp} л.с. (30-мин.)`
        : `${suggestion.powerHp} л.с.`,
    );
  }
  return parts.join(" · ") || fallback;
}
