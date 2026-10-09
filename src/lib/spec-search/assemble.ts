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
      host.includes("kia.")
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

export function assembleSpecSuggestion(
  docs: SpecDocument[],
  userQuery: string,
): QuickSearchSuggestion | null {
  const extracted = docs.map((doc) => ({
    doc,
    specs: extractSpecsFromDocument([doc.title, doc.text].filter(Boolean).join("\n")),
    weight: hostWeight(doc.url),
  }));

  const volumeVotes = extracted.flatMap((item) =>
    item.specs.volumeCc
      ? [
          {
            value: item.specs.volumeCc,
            weight: item.weight * (isFeeLikeVolume(item.specs.volumeCc) ? 0.35 : 1),
          },
        ]
      : [],
  );
  const icePowerVotes = extracted.flatMap((item) =>
    item.specs.icePowerHp ? [{ value: item.specs.icePowerHp, weight: item.weight }] : [],
  );
  const electricPowerVotes = extracted.flatMap((item) =>
    item.specs.electricPowerHp
      ? [{ value: item.specs.electricPowerHp, weight: item.weight }]
      : [],
  );
  const kindVotes = extracted.flatMap((item) =>
    item.specs.engineKind
      ? [{ value: item.specs.engineKind, weight: item.weight }]
      : [],
  );
  const layoutVotes = extracted.flatMap((item) =>
    item.specs.hybridLayout
      ? [{ value: item.specs.hybridLayout, weight: item.weight }]
      : [],
  );
  const originVotes = extracted.flatMap((item) =>
    item.specs.originCountry
      ? [{ value: item.specs.originCountry, weight: item.weight }]
      : [],
  );

  const engineKind = (pickVoted(kindVotes) as QuickSearchEngineKind | null) ?? null;
  const hybridLayout = (pickVoted(layoutVotes) as HybridLayout | null) ?? null;
  const volumeCc = pickVoted(volumeVotes);
  const icePowerHp = pickVoted(icePowerVotes);
  const electricPowerHp = pickVoted(electricPowerVotes);
  const resolved = resolveUtilPower({
    engineKind,
    layout: hybridLayout,
    icePowerHp,
    electricPowerHp,
  });
  const originCountry = pickVoted(originVotes);
  const title =
    extracted.find((item) => item.specs.title)?.specs.title ?? titleFromUserQuery(userQuery);
  const engine =
    engineKind === "electric"
      ? "electric"
      : volumeCc || engineKind === "hybrid" || engineKind === "phev" || engineKind === "ice"
        ? "petrol"
        : null;
  const age = extracted.find((item) => item.specs.age)?.specs.age ?? null;

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
