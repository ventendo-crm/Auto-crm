import {
  extractSpecsVariantsFromDocument,
  parseTrimAnchors,
  resolveUtilPower,
  textHasStrongEvOrPhevSignal,
  titleFromUserQuery,
  withHybridNote,
  type HybridLayout,
  type QuickSearchEngineKind,
  type QuickSearchSuggestion,
  type TrimAnchors,
} from "@/lib/tavily/calculator-suggestion";
import type { SpecDocument } from "@/lib/spec-search/wikipedia";

export type SpecTrimCandidate = {
  id: string;
  label: string;
  suggestion: QuickSearchSuggestion;
  sourceUrl: string | null;
  sourceTitle: string | null;
  /** Совпадение с запрошенной комплектацией (выше — лучше). */
  matchScore: number;
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
      host.includes("changan") ||
      host.includes("trumpchi")
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

/** Известные марки для мягкой поправки опечаток (mazds → mazda). */
const KNOWN_BRANDS = [
  "mazda",
  "toyota",
  "hyundai",
  "kia",
  "bmw",
  "audi",
  "mercedes",
  "volkswagen",
  "ford",
  "nissan",
  "honda",
  "subaru",
  "mitsubishi",
  "lexus",
  "volvo",
  "skoda",
  "changan",
  "geely",
  "byd",
  "zeekr",
  "gac",
  "trumpchi",
  "haval",
  "chery",
  "exeed",
  "lixiang",
  "li",
  "nio",
  "xpeng",
  "tesla",
  "chevrolet",
  "jeep",
  "porsche",
  "genesis",
] as const;

function editDistanceOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a === b) return true;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (a.length < b.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  if (i < a.length || j < b.length) edits += 1;
  return edits <= 1;
}

function resolveBrandToken(token: string): string | null {
  const lower = token.toLowerCase();
  if ((KNOWN_BRANDS as readonly string[]).includes(lower)) return lower;
  if (lower.length < 4) return null;
  for (const brand of KNOWN_BRANDS) {
    if (brand.length >= 4 && editDistanceOne(lower, brand)) return brand;
  }
  return null;
}

function normalizeCompact(value: string): string {
  return value.toLowerCase().replace(/[-_.\s]/g, "");
}

/** Токены марки/модели с сохранением cx-5 как одного идентификатора. */
function modelQueryParts(query: string): {
  brand: string | null;
  modelIds: string[];
  tokens: string[];
} {
  const modelPart = parseTrimAnchors(query).modelPart.toLowerCase();
  const tokens =
    modelPart.match(/[a-zа-яё0-9]+(?:-[a-zа-яё0-9]+)+|[a-zа-яё0-9]{2,}/gi)?.map((t) =>
      t.toLowerCase(),
    ) ?? [];
  let brand: string | null = null;
  const modelIds: string[] = [];
  for (const token of tokens) {
    // Год и рынок — не идентификаторы модели (иначе «2026»/china ломают матчинг).
    if (/^(19|20)\d{2}$/.test(token)) continue;
    if (/^(china|korea|kyrgyzstan|китай|корея|киргизия|рф|russia)$/i.test(token)) continue;

    const resolved = resolveBrandToken(token);
    if (resolved && !brand) {
      brand = resolved;
      continue;
    }
    if (token.includes("-") || /\d/.test(token)) {
      modelIds.push(token, normalizeCompact(token));
    } else if (token.length >= 2) {
      modelIds.push(token);
    }
  }
  return { brand, modelIds: [...new Set(modelIds)], tokens };
}

/**
 * Релевантность страницы к запрошенной марке/модели.
 * Чужие брендбуки (Geely при поиске Mazda) дают 0 и отбрасываются.
 */
function modelRelevance(text: string, query: string): number {
  const hay = text.toLowerCase();
  const hayCompact = normalizeCompact(text);
  const { brand, modelIds, tokens } = modelQueryParts(query);

  let score = 0;
  let modelHit = false;

  for (const id of modelIds) {
    if (id.length < 2) continue;
    if (hay.includes(id) || hayCompact.includes(normalizeCompact(id))) {
      score += id.includes("-") || /\d/.test(id) ? 6 : 2;
      modelHit = true;
    }
  }

  if (brand) {
    if (hay.includes(brand) || hayCompact.includes(brand)) {
      score += 4;
    } else {
      // Опечатка в запросе: в тексте правильная марка
      score -= 2;
    }
  }

  // Штраф, если в заголовке/начале явная чужая марка
  const lead = hay.slice(0, 400);
  for (const other of KNOWN_BRANDS) {
    if (brand && other === brand) continue;
    if (new RegExp(`\\b${other}\\b`).test(lead) && (!brand || !lead.includes(brand))) {
      score -= 5;
      break;
    }
  }

  // Без совпадения модели (cx-5) не считаем страницу полезной, если модель была в запросе
  const requiredModel = modelIds.some((id) => id.includes("-") || /\d/.test(id));
  if (requiredModel && !modelHit) {
    return Math.min(score, 0);
  }

  if (!brand && !modelHit) {
    score = tokens.reduce((sum, token) => sum + (hay.includes(token) ? 1 : 0), 0);
  }

  return score;
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
  const rangeVotes = group.flatMap((item) =>
    item.specs.batteryRangeKm
      ? [{ value: item.specs.batteryRangeKm, weight: item.weight }]
      : [],
  );
  const drivetrainVotes = group.flatMap((item) =>
    item.specs.drivetrain ? [{ value: item.specs.drivetrain, weight: item.weight }] : [],
  );

  let engineKind = (pickVoted(kindVotes) as QuickSearchEngineKind | null) ?? null;
  let volumeCc = engineKind === "electric" ? null : pickVoted(volumeVotes);
  let icePowerHp = engineKind === "electric" ? null : pickVoted(icePowerVotes);
  let electricPowerHp = pickVoted(electricPowerVotes);
  let batteryRangeKm = pickVoted(rangeVotes);
  let hybridLayout =
    engineKind === "electric"
      ? null
      : ((pickVoted(layoutVotes) as HybridLayout | null) ?? null);

  const groupBlob = group
    .map((item) => [item.doc.title, item.doc.text].filter(Boolean).join("\n"))
    .join("\n");
  // Ложный PHEV/hybrid без электро-цифр → обычный бензин (не ищем 30-мин. мощность).
  if (
    (engineKind === "phev" || engineKind === "hybrid") &&
    volumeCc &&
    !electricPowerHp &&
    !batteryRangeKm &&
    !textHasStrongEvOrPhevSignal(groupBlob)
  ) {
    engineKind = "ice";
    hybridLayout = null;
    electricPowerHp = null;
    batteryRangeKm = null;
  }

  if (engineKind === "ice") {
    electricPowerHp = null;
    batteryRangeKm = null;
    hybridLayout = null;
  }
  if (engineKind === "electric") {
    volumeCc = null;
    icePowerHp = null;
  }

  const isElectric = engineKind === "electric";
  const drivetrain = pickVoted(drivetrainVotes) as QuickSearchSuggestion["drivetrain"];
  const tagVotes = new Map<string, number>();
  for (const item of group) {
    for (const tag of item.specs.trimTags ?? []) {
      tagVotes.set(tag, (tagVotes.get(tag) ?? 0) + item.weight);
    }
  }
  const trimTags =
    engineKind === "ice"
      ? null
      : tagVotes.size > 0
        ? [...tagVotes.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([tag]) => tag)
        : null;

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
    batteryRangeKm,
    drivetrain,
    trimTags,
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
    suggestion.batteryRangeKm ?? "-",
    suggestion.drivetrain ?? "-",
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
  if (suggestion.batteryRangeKm) parts.push(`${suggestion.batteryRangeKm} km`);
  if (suggestion.drivetrain === "4wd") parts.push("4WD");
  if (suggestion.drivetrain === "2wd") parts.push("2WD");
  if (suggestion.trimTags?.includes("ultra")) parts.push("Ultra");
  if (suggestion.trimTags?.includes("lidar")) parts.push("LiDAR");
  for (const tag of suggestion.trimTags ?? []) {
    if (tag === "ultra" || tag === "lidar") continue;
    parts.push(tag.charAt(0).toUpperCase() + tag.slice(1));
  }
  if (suggestion.powerHp) parts.push(`${suggestion.powerHp} л.с.`);
  return parts.join(" · ") || suggestion.title || "Комплектация";
}

/** Насколько комплектация совпадает с якорями запроса. */
export function scoreTrimAgainstAnchors(
  suggestion: QuickSearchSuggestion,
  textBlob: string,
  anchors: TrimAnchors,
): number {
  const hay = textBlob.toLowerCase();
  let score = 0;

  if (anchors.batteryRangeKm != null) {
    const wanted = anchors.batteryRangeKm;
    const hasWanted =
      suggestion.batteryRangeKm === wanted ||
      hay.includes(`${wanted} km`) ||
      hay.includes(`${wanted}km`) ||
      hay.includes(`${wanted} км`) ||
      new RegExp(`续航[^\\d]{0,8}${wanted}`).test(hay);
    if (hasWanted || suggestion.batteryRangeKm === wanted) {
      score += 12;
    } else if (suggestion.batteryRangeKm != null && suggestion.batteryRangeKm !== wanted) {
      score -= 10;
    } else {
      // В тексте есть другой типичный пробег рядом с комплектацией
      const rival = hay.match(/\b(1[5-9]0|2[0-4]0|2[5-9]0|3[0-5]0)\s*(?:km|км)\b/);
      if (rival && Number(rival[1]) !== wanted) score -= 6;
    }
  }

  if (anchors.drivetrain) {
    if (suggestion.drivetrain === anchors.drivetrain) score += 4;
    else if (suggestion.drivetrain && suggestion.drivetrain !== anchors.drivetrain) score -= 3;
    else if (
      (anchors.drivetrain === "4wd" && /\b(4wd|awd|四驱)\b/.test(hay)) ||
      (anchors.drivetrain === "2wd" && /\b(2wd|两驱)\b/.test(hay))
    ) {
      score += 3;
    }
  }

  for (const tag of anchors.tags) {
    if (suggestion.trimTags?.includes(tag)) score += 3;
    else if (tag === "lidar" && (/\blida?r\b/.test(hay) || hay.includes("激光雷达"))) score += 3;
    else if (tag !== "lidar" && new RegExp(`\\b${tag}\\b`).test(hay)) score += 2;
  }

  // Полнота полей калькулятора — только tie-breaker
  if (suggestion.engineKind) score += 1;
  if (suggestion.powerHp) score += 1;
  if (suggestion.volumeCc || suggestion.engine === "electric") score += 0.5;
  if (suggestion.hybridLayout) score += 0.5;

  return score;
}

export function trimMatchesRequestedRange(
  suggestion: QuickSearchSuggestion | null,
  anchors: TrimAnchors,
): boolean {
  if (!anchors.batteryRangeKm || !suggestion) return true;
  return suggestion.batteryRangeKm === anchors.batteryRangeKm;
}

function completenessScore(suggestion: QuickSearchSuggestion): number {
  let score = 0;
  if (suggestion.engineKind) score += 1;
  if (suggestion.volumeCc) score += 3;
  if (suggestion.powerHp || suggestion.icePowerHp) score += 2;
  if (suggestion.engineKind === "ice" && suggestion.volumeCc) score += 2;
  // Неполный PHEV без объёма/мощностей не должен вытеснять бензин 2.0
  if (
    (suggestion.engineKind === "phev" || suggestion.engineKind === "hybrid") &&
    !suggestion.volumeCc &&
    !suggestion.icePowerHp &&
    !suggestion.electricPowerHp
  ) {
    score -= 6;
  }
  return score;
}

export function listTrimCandidates(
  docs: SpecDocument[],
  userQuery: string,
): SpecTrimCandidate[] {
  const anchors = parseTrimAnchors(userQuery);
  const extracted = docs.flatMap((doc) => {
    const blob = [doc.title, doc.text].filter(Boolean).join("\n");
    const relevance = modelRelevance(blob, userQuery);
    const weight = hostWeight(doc.url);
    return extractSpecsVariantsFromDocument(blob).map(
      (specs) =>
        ({
          doc,
          specs,
          weight,
          relevance,
        }) satisfies ExtractedDoc,
    );
  });

  const bestRelevance = extracted.reduce((max, item) => Math.max(max, item.relevance), 0);
  // Не берём страницы с relevance ≤ 0 (чужой бренд / без модели) — иначе Mazda тянет Geely PHEV.
  const matched = extracted.filter((item) => item.relevance > 0);
  const focused =
    matched.length > 0
      ? matched.filter((item) => item.relevance >= Math.max(1, bestRelevance - 2))
      : [];

  if (focused.length === 0) {
    return [];
  }

  const byKind = new Map<string, ExtractedDoc[]>();
  for (const item of focused) {
    const key = [
      item.specs.engineKind ?? "unknown",
      item.specs.hybridLayout ?? "-",
      item.specs.volumeCc ?? "-",
      item.specs.batteryRangeKm ?? "-",
      item.specs.drivetrain ?? "-",
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
    const blob = group
      .map((item) => [item.doc.title, item.doc.text].filter(Boolean).join("\n"))
      .join("\n");
    const matchScore =
      scoreTrimAgainstAnchors(suggestion, blob, anchors) + completenessScore(suggestion);
    candidates.push({
      id: trimFingerprint(suggestion),
      label: trimLabel(suggestion),
      suggestion,
      sourceUrl: bestDoc?.doc.url ?? null,
      sourceTitle: bestDoc?.doc.title ?? null,
      matchScore,
    });
  }

  // До 5 вариантов, чтобы и бензин 2.0, и PHEV остались в списке / уточнении типа.
  return candidates
    .sort((a, b) => b.matchScore - a.matchScore || a.label.localeCompare(b.label, "ru"))
    .slice(0, 5);
}

/** Уникальные типы двигателя среди найденных комплектаций. */
export function distinctEngineKinds(
  trims: SpecTrimCandidate[],
): QuickSearchEngineKind[] {
  const seen = new Set<QuickSearchEngineKind>();
  const order: QuickSearchEngineKind[] = [];
  for (const trim of trims) {
    const kind = trim.suggestion.engineKind;
    if (!kind || seen.has(kind)) continue;
    seen.add(kind);
    order.push(kind);
  }
  return order;
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
  if (suggestion.batteryRangeKm) parts.push(`${suggestion.batteryRangeKm} km`);
  if (suggestion.drivetrain === "4wd") parts.push("4WD");
  if (suggestion.trimTags?.includes("ultra")) parts.push("Ultra");
  if (suggestion.trimTags?.includes("lidar")) parts.push("LiDAR");
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

/** Краткий вывод с предупреждением, если запрошенный пробег не найден. */
export function buildSearchSummary(
  trims: SpecTrimCandidate[],
  suggestion: QuickSearchSuggestion | null,
  userQuery: string,
  fallback: string,
): string {
  const anchors = parseTrimAnchors(userQuery);
  const exactRange = anchors.batteryRangeKm
    ? trims.some((item) => item.suggestion.batteryRangeKm === anchors.batteryRangeKm)
    : true;
  const exactMatch =
    trims.length > 0 &&
    (!anchors.batteryRangeKm || exactRange) &&
    trims[0]!.matchScore >= (anchors.batteryRangeKm ? 8 : 0);

  const kinds = distinctEngineKinds(trims);
  if (kinds.length > 1) {
    return "В источниках разные типы двигателя. Уточните тип — затем можно выбрать комплектацию.";
  }

  if (anchors.batteryRangeKm && !exactRange) {
    const rivals = trims
      .map((item) => item.suggestion.batteryRangeKm)
      .filter((value): value is number => value != null && value !== anchors.batteryRangeKm);
    const rivalText = rivals.length > 0 ? ` (в т.ч. ${[...new Set(rivals)].join(", ")} km)` : "";
    return `Комплектация ${anchors.batteryRangeKm} km в источниках не найдена; ниже близкие варианты${rivalText}. Проверьте выбор перед переносом.`;
  }

  if (trims.length > 1) {
    if (exactMatch && anchors.batteryRangeKm) {
      return `Найдено комплектаций: ${trims.length}. Первой стоит ближайшая к запросу (${anchors.batteryRangeKm} km${anchors.drivetrain ? `, ${anchors.drivetrain.toUpperCase()}` : ""}).`;
    }
    return `Найдено комплектаций: ${trims.length}. Выберите нужную — от этого зависят объём и мощность.`;
  }

  return specSummary(suggestion, fallback);
}
