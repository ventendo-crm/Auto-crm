import type {
  CarAge,
  CurrencyCode,
  EngineType,
  ImporterType,
  OriginCountry,
} from "../customs-calculator/rates";

export type QuickSearchEngineKind = "ice" | "hybrid" | "phev" | "electric";

/** Последовательный — колёса крутит электромотор. Параллельный — и ДВС, и электромотор. */
export type HybridLayout = "series" | "parallel";

export type DrivetrainKind = "2wd" | "4wd";

export type TrimAnchors = {
  /** Запрошенный электрический пробег комплектации, км (CLTC/WLTC). */
  batteryRangeKm: number | null;
  drivetrain: DrivetrainKind | null;
  /** Издание/опции: ultra, lidar, … */
  tags: string[];
  /** Марка/модель без якорей комплектации. */
  modelPart: string;
};

export type QuickSearchSuggestion = {
  title: string | null;
  originCountry: OriginCountry | null;
  engineKind: QuickSearchEngineKind | null;
  hybridLayout: HybridLayout | null;
  engine: EngineType | null;
  /** Мощность, которая уходит в калькулятор. */
  powerHp: number | null;
  icePowerHp: number | null;
  /** 30-минутная мощность электромотора. */
  electricPowerHp: number | null;
  volumeCc: number | null;
  /** Электрический пробег комплектации (для различения 180/240 km). */
  batteryRangeKm: number | null;
  drivetrain: DrivetrainKind | null;
  trimTags: string[] | null;
  price: number | null;
  currency: CurrencyCode | null;
  age: CarAge | null;
  importer: ImporterType | null;
  note: string | null;
};

/** Фиксированная задача: менеджер вводит только марку и модель. */
export const UTIL_SEARCH_TEMPLATE =
  "Рассчитай утильсбор для импорта автомобиля в Россию";

const KNOWN_TRIM_TAGS = ["ultra", "lidar", "max", "pro", "plus", "flagship", "premium"] as const;

/** Якоря комплектации из запроса менеджера (240 km, 4WD, Ultra, LiDAR). */
export function parseTrimAnchors(query: string): TrimAnchors {
  const raw = query.trim();
  const lower = raw.toLowerCase();

  let batteryRangeKm: number | null = null;
  const rangePatterns = [
    /(\d{2,3})\s*(?:km|км)\b/i,
    /(?:续航|纯电续航|electric\s+range|cltc|wltc)[^\d]{0,12}(\d{2,3})/i,
    /(\d{2,3})\s*(?:km|км)?\s*(?:cltc|wltc|续航)/i,
  ];
  for (const pattern of rangePatterns) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      const value = Number(match[1]);
      if (value >= 50 && value <= 900) {
        batteryRangeKm = value;
        break;
      }
    }
  }

  let drivetrain: DrivetrainKind | null = null;
  if (/\b(4wd|awd|4x4|四驱|全时四驱)\b/i.test(lower)) drivetrain = "4wd";
  else if (/\b(2wd|fwd|rwd|两驱|前驱|后驱)\b/i.test(lower)) drivetrain = "2wd";

  const tags: string[] = [];
  for (const tag of KNOWN_TRIM_TAGS) {
    if (tag === "lidar") {
      if (/\blida?r\b/i.test(lower) || lower.includes("激光雷达")) tags.push("lidar");
    } else if (new RegExp(`\\b${tag}\\b`, "i").test(lower)) {
      tags.push(tag);
    }
  }

  const modelPart = raw
    .replace(/(\d{2,3})\s*(?:km|км)\b/gi, " ")
    .replace(/(?:续航|纯电续航|electric\s+range|cltc|wltc)[^\d]{0,12}\d{2,3}/gi, " ")
    .replace(/\b(4wd|awd|4x4|2wd|fwd|rwd|四驱|两驱|全时四驱|前驱|后驱)\b/gi, " ")
    .replace(/\b(lidar|lida|laser\s*radar|edition|версия|комплектаци\w*)\b/gi, " ")
    .replace(/\b(ultra|max|pro|plus|flagship|premium)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    batteryRangeKm,
    drivetrain,
    tags,
    modelPart: modelPart.length >= 2 ? modelPart : raw,
  };
}

/**
 * В Tavily уходит только то, что ввёл менеджер (марка, модель, комплектация).
 * Тип двигателя не подсказываем словами petrol/EV — его определяет разбор страниц.
 */
export function buildSpecRetrievalQuery(userQuery: string): string {
  return userQuery.trim();
}

/** Допоиск: тот же запрос менеджера + список недостающих полей на русском. */
export function buildMissingFieldsQuery(model: string, missing: string[]): string {
  const parts = [model.trim(), ...missing.map((item) => item.trim()).filter(Boolean)];
  return parts.join(" ");
}

/** Пробег / привод / издание из текста страницы спецификаций. */
export function extractTrimMarkersFromText(text: string): {
  batteryRangeKm: number | null;
  drivetrain: DrivetrainKind | null;
  trimTags: string[];
} {
  const lower = text.toLowerCase();
  const rangeVotes = new Map<number, number>();

  const bump = (value: number, weight: number) => {
    if (value < 50 || value > 900) return;
    rangeVotes.set(value, (rangeVotes.get(value) ?? 0) + weight);
  };

  for (const match of text.matchAll(
    /(?:纯电续航|综合续航|续航里程|续航|electric\s+range|ev\s+range|all[- ]electric\s+range|cltc|wltc)[^\d]{0,16}(\d{2,3})\s*(?:km|км)?/gi,
  )) {
    bump(Number(match[1]), 3);
  }
  for (const match of text.matchAll(/(\d{2,3})\s*(?:km|км)\b/gi)) {
    const value = Number(match[1]);
    // Заводские комплектации PHEV часто 80–300 km; отсекаем годы и коды.
    if (value >= 80 && value <= 400) bump(value, 1);
  }
  // «240 km Ultra» / «180KM 4WD» в названии комплектации
  for (const match of text.matchAll(
    /(\d{2,3})\s*(?:km|км)\s*(?:ultra|max|pro|lidar|4wd|awd|edition|dht)/gi,
  )) {
    bump(Number(match[1]), 4);
  }

  let batteryRangeKm: number | null = null;
  let bestScore = 0;
  for (const [value, score] of rangeVotes) {
    if (score > bestScore) {
      batteryRangeKm = value;
      bestScore = score;
    }
  }

  let drivetrain: DrivetrainKind | null = null;
  if (/\b(4wd|awd|4x4|四驱|全时四驱)\b/i.test(lower)) drivetrain = "4wd";
  else if (/\b(2wd|fwd|rwd|两驱|前驱|后驱)\b/i.test(lower)) drivetrain = "2wd";

  const trimTags: string[] = [];
  for (const tag of KNOWN_TRIM_TAGS) {
    if (tag === "lidar") {
      if (/\blida?r\b/i.test(lower) || lower.includes("激光雷达")) trimTags.push("lidar");
    } else if (new RegExp(`\\b${tag}\\b`, "i").test(lower)) {
      trimTags.push(tag);
    }
  }

  return { batteryRangeKm, drivetrain, trimTags };
}

/** @deprecated используйте buildSpecRetrievalQuery */
export function buildCalculatorSearchQuery(userQuery: string): string {
  return buildSpecRetrievalQuery(userQuery);
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asPositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", ".").replace(/\s/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || text;
  const start = candidate.lastIndexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return asObject(JSON.parse(candidate.slice(start, end + 1)));
  } catch {
    return null;
  }
}

function parseOrigin(value: unknown): OriginCountry | null {
  const raw = asString(value)?.toLowerCase();
  if (raw === "china" || raw === "korea" || raw === "kyrgyzstan") return raw;
  if (raw === "китай") return "china";
  if (raw === "корея" || raw === "south korea") return "korea";
  if (raw === "киргизия" || raw === "кыргызстан") return "kyrgyzstan";
  return null;
}

function parseEngineKind(value: unknown): QuickSearchEngineKind | null {
  const raw = asString(value)?.toLowerCase();
  if (raw === "ice" || raw === "hybrid" || raw === "phev" || raw === "electric") return raw;
  if (!raw) return null;
  if (raw.includes("phev") || raw.includes("подключаем")) return "phev";
  if (raw.includes("hybrid") || raw.includes("гибрид")) return "hybrid";
  if (raw.includes("electro") || raw.includes("электро")) return "electric";
  if (raw.includes("petrol") || raw.includes("diesel") || raw.includes("бензин") || raw.includes("дизель")) {
    return "ice";
  }
  return null;
}

function parseEngine(value: unknown, kind: QuickSearchEngineKind | null): EngineType | null {
  if (kind === "hybrid" || kind === "phev") {
    const raw = asString(value)?.toLowerCase();
    if (raw === "diesel" || raw === "дизель") return "diesel";
    return "petrol";
  }
  const raw = asString(value)?.toLowerCase();
  if (raw === "petrol" || raw === "diesel" || raw === "electric") return raw;
  if (raw === "бензин") return "petrol";
  if (raw === "дизель") return "diesel";
  if (raw === "электро" || raw === "ev" || raw === "bev") return "electric";
  if (kind === "electric") return "electric";
  if (kind === "ice") return "petrol";
  return null;
}

function parseAge(value: unknown): CarAge | null {
  const raw = asString(value)?.toLowerCase();
  if (raw === "new" || raw === "under3" || raw === "from3to5" || raw === "from5to7" || raw === "over7") {
    return raw;
  }
  if (!raw) return null;
  if (raw.includes("нов")) return "new";
  if (raw.includes("до 3") || raw.includes("under3")) return "under3";
  return null;
}

function parseCurrency(value: unknown): CurrencyCode | null {
  const raw = asString(value)?.toUpperCase();
  if (raw === "CNY" || raw === "USD" || raw === "KRW" || raw === "RUB") return raw;
  if (raw === "ЮАНЬ" || raw === "RMB") return "CNY";
  if (raw === "ВОНА") return "KRW";
  return null;
}

function parseImporter(value: unknown): ImporterType | null {
  const raw = asString(value)?.toLowerCase();
  if (raw === "personal" || raw === "resale" || raw === "legal") return raw;
  return null;
}

export function humanSummaryFromAnswer(text: string): string {
  const withoutFence = text.replace(/```[\s\S]*?```/g, " ").trim();
  const start = withoutFence.lastIndexOf("{");
  const prose = (start >= 0 ? withoutFence.slice(0, start) : withoutFence).replace(/\s+/g, " ").trim();
  if (!prose) return "";
  const match = prose.match(/^(.+?[.!?…])(?:\s|$)/u);
  return (match?.[1] ?? prose).trim();
}

const KW_TO_HP = 1.35962;

function kwToHp(kw: number): number {
  return Math.round(kw * KW_TO_HP);
}

function firstMatchNumber(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const global = new RegExp(pattern.source, flags);
    for (const match of text.matchAll(global)) {
      const raw = match[1] ?? match[2];
      const value = asPositiveNumber(raw);
      if (value) return value;
    }
  }
  return null;
}

function stripJsonBlocks(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\{[^{}]{0,800}\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlaceholderTitle(title: string | null): boolean {
  if (!title) return true;
  const normalized = title.toLowerCase().replace(/\s+/g, " ").trim();
  return (
    normalized === "марка модель" ||
    normalized === "марка" ||
    normalized === "model" ||
    normalized.includes("марка модель")
  );
}

function jsonLooksLikeTemplate(json: Record<string, unknown>): boolean {
  const title = asString(json.title);
  if (title && isPlaceholderTitle(title)) return true;
  const note = asString(json.note) ?? "";
  if (note.includes("для гибрида в расчёт взята мощность ДВС")) return true;
  return false;
}

function jsonLooksLikeDefaultNumbers(json: Record<string, unknown>): boolean {
  return asPositiveNumber(json.powerHp ?? json.power_hp) === 150 &&
    asPositiveNumber(json.volumeCc ?? json.volume_cc) === 2000;
}

function textConfirmsVolume(text: string, volumeCc: number): boolean {
  const liters = (volumeCc / 1000).toFixed(1).replace(".", "[.,]");
  const re = new RegExp(
    `${volumeCc}\\s*(?:см|cc|куб)|${liters}\\s*(?:л(?![.\\s]*с)|L\\b|T\\b)`,
    "i",
  );
  return re.test(text);
}

function textConfirmsPower(text: string, powerHp: number): boolean {
  const re = new RegExp(`${powerHp}\\s*(?:л\\.\\s*с|л\\.?\\s*с\\.?|hp|h\\.?p\\.?)`, "i");
  return re.test(text);
}

export function titleFromUserQuery(query: string): string | null {
  const cleaned = query
    .replace(
      /\b(утильсбор|утилизационн\w*|растаможк\w*|посчитай|посчитать|расчёт|расчет|калькулятор|мощность|объём|объем|характеристик\w*|импорт\w*|автомобил\w*|росси[яиею]|рф)\b/gi,
      " ",
    )
    .replace(/[?!,.:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 3) return null;
  return cleaned.slice(0, 120);
}

function firstMarkerIndex(text: string, patterns: RegExp[]): number | null {
  let best: number | null = null;
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.index == null) continue;
    if (best == null || match.index < best) best = match.index;
  }
  return best;
}

function isMildHybridOnly(text: string): boolean {
  const lower = text.toLowerCase();
  if (!/(mild\s*hybrid|soft\s*hybrid|m[- ]?hybrid|微混|轻混)/i.test(lower)) return false;
  return !textHasStrongEvOrPhevSignal(lower);
}

/** Тип по началу страницы: ДВС тоже учитываем — иначе PHEV в лиде перебивает 2.0 бензин. */
function detectLeadPowertrain(text: string): QuickSearchEngineKind | null {
  const lead = text.slice(0, 700).toLowerCase();
  const electricAt = firstMarkerIndex(lead, [
    /纯电/,
    /电动汽车/,
    /电动车/,
    /\bbev\b/,
    /электромобил/,
    /pure electric/,
    /battery electric/,
    /fully electric/,
  ]);
  const phevAt = firstMarkerIndex(lead, [/phev/, /plug-in/, /plugin/, /插电混动/, /插电式/, /подключаем/]);
  const hybridAt = isMildHybridOnly(lead)
    ? null
    : firstMarkerIndex(lead, [
        /(?<!mild\s)(?<!soft\s)\bhybrid\b/,
        /гибрид/,
        /混动/,
        /增程式/,
        /range extender/,
        /\berev\b/,
        /\breev\b/,
      ]);
  const iceAt = firstMarkerIndex(lead, [
    /\bgasoline\b/,
    /\bpetrol\b/,
    /бензин/,
    /\bdiesel\b/,
    /дизель/,
    /skylactiv-?g/,
    /2\.[05]\s*l\b/,
    /2\.[05]\s*литр/,
    /自然吸气|燃油版|汽油/,
  ]);
  const ranked: Array<{ at: number; kind: QuickSearchEngineKind }> = [];
  if (electricAt != null) ranked.push({ at: electricAt, kind: "electric" });
  if (phevAt != null) ranked.push({ at: phevAt, kind: "phev" });
  if (hybridAt != null) ranked.push({ at: hybridAt, kind: "hybrid" });
  if (iceAt != null) ranked.push({ at: iceAt, kind: "ice" });
  ranked.sort((a, b) => a.at - b.at);
  return ranked[0]?.kind ?? null;
}

function detectEngineKindFromText(text: string): QuickSearchEngineKind | null {
  const fromLead = detectLeadPowertrain(text);
  if (fromLead) return fromLead;

  const lower = text.toLowerCase();
  if (
    lower.includes("phev") ||
    lower.includes("plug-in") ||
    lower.includes("plugin") ||
    lower.includes("подключаем") ||
    lower.includes("插电")
  ) {
    return "phev";
  }
  if (
    !isMildHybridOnly(lower) &&
    (lower.includes("hybrid") ||
      lower.includes("гибрид") ||
      lower.includes("混动") ||
      lower.includes("range extender") ||
      lower.includes("удлинител") ||
      lower.includes("rehv") ||
      lower.includes("er ev") ||
      lower.includes("e-rev"))
  ) {
    return "hybrid";
  }
  if (
    /\bbev\b/.test(lower) ||
    lower.includes("электромобил") ||
    lower.includes("electric vehicle") ||
    lower.includes("纯电") ||
    lower.includes("电动汽车") ||
    lower.includes("电动车") ||
    (lower.includes("электро") && !lower.includes("гибрид"))
  ) {
    return "electric";
  }
  if (
    lower.includes("дизель") ||
    lower.includes("diesel") ||
    lower.includes("бензин") ||
    lower.includes("petrol") ||
    lower.includes("gasoline")
  ) {
    return "ice";
  }
  return null;
}

function parseThirtyMinutePowerHp(text: string): number | null {
  const thirtyMinHp = firstMatchNumber(text, [
    /30[-\s]?мин(?:утн\w*)?[^\n]{0,50}?(\d{2,4})\s*(?:л\.?\s*с\.?|hp|PS)/i,
    /(\d{2,4})\s*(?:л\.?\s*с\.?|hp|PS)[^\n]{0,40}?30[-\s]?мин/i,
    /получасов\w*[^\n]{0,40}?(\d{2,4})\s*(?:л\.?\s*с\.?|hp)/i,
    /30[-\s]?minute[^\n]{0,50}?(\d{2,4})\s*(?:hp|PS)/i,
    /(\d{2,4})\s*(?:hp|PS)[^\n]{0,40}?30[-\s]?min/i,
    /半小时功率[^\n]{0,24}?(\d{2,4})/,
    /30\s*分钟功率[^\n]{0,24}?(\d{2,4})/,
  ]);
  if (thirtyMinHp) return Math.round(thirtyMinHp);

  const thirtyMinKw = firstMatchNumber(text, [
    /30[-\s]?мин(?:утн\w*)?[^\n]{0,50}?(\d{2,4}(?:[.,]\d+)?)\s*(?:кВт|kW)/i,
    /(\d{2,4}(?:[.,]\d+)?)\s*(?:кВт|kW)[^\n]{0,40}?30[-\s]?мин/i,
    /30[-\s]?min(?:ute)?[^\n]{0,50}?(\d{2,4}(?:[.,]\d+)?)\s*kW/i,
    /UNECE\s*R?85[^\n]{0,40}?(\d{2,4}(?:[.,]\d+)?)\s*(?:кВт|kW)/i,
    /半小时功率[^\n]{0,24}?(\d{2,4}(?:[.,]\d+)?)\s*(?:kW|千瓦)/i,
    /30\s*分钟功率[^\n]{0,24}?(\d{2,4}(?:[.,]\d+)?)\s*(?:kW|千瓦)/i,
  ]);
  if (thirtyMinKw) return kwToHp(thirtyMinKw);
  return null;
}

export function detectHybridLayout(text: string): HybridLayout | null {
  const lower = text.toLowerCase();
  const series =
    /последовательн|series hybrid|range extender|удлинител|erev|\breev\b|re-ev|增程式|串联/.test(lower);
  const parallel =
    /параллельн|parallel hybrid|series-parallel|power-split|смешанн|并联|混联/.test(lower);
  if (series && parallel) {
    if (/range extender|erev|增程|последовательн|串联/.test(lower) && !/series-parallel|混联/.test(lower)) {
      return "series";
    }
    return "parallel";
  }
  if (series) return "series";
  if (parallel) return "parallel";
  return null;
}

function parseIcePowerHp(text: string, allowGeneric: boolean): number | null {
  const labeled = firstMatchNumber(text, [
    /(?:ДВС|ICE|бензин(?:овый)?(?:\s+двигатель)?|petrol(?:\s+engine)?|diesel(?:\s+engine)?)[^\n]{0,50}?(\d{2,4})\s*(?:л\.?\s*с\.?|hp|PS)/i,
    /(\d{2,4})\s*(?:л\.?\s*с\.?|hp|PS)[^\n]{0,40}?(?:ДВС|ICE|бензин|дизел)/i,
    /мощность\s+ДВС[^\n]{0,20}?(\d{2,4})/i,
  ]);
  if (labeled) return Math.round(labeled);
  const labeledKw = firstMatchNumber(text, [
    /(?:ДВС|ICE|бензин(?:овый)?|diesel)[^\n]{0,50}?(\d{2,3}(?:[.,]\d+)?)\s*(?:кВт|kW)/i,
  ]);
  if (labeledKw) return kwToHp(labeledKw);
  const besideDisplacement = firstMatchNumber(text, [
    /\d(?:[.,]\d{1,2})?\s*-?\s*T[^\n]{0,30}?(\d{2,4})\s*(?:hp|PS|л\.?\s*с)/i,
    /(\d{2,4})\s*(?:hp|PS|л\.?\s*с\.?)[^\n]{0,20}?\d(?:[.,]\d{1,2})?\s*-?\s*T\b/i,
  ]);
  if (besideDisplacement) return Math.round(besideDisplacement);
  if (!allowGeneric) return null;

  const stripped = text.replace(
    /(?:суммарн\w*|системн\w*|combined|общая\s+мощност\w*|электромотор\w*|electric motor|30[-\s]?мин\w*|30[-\s]?min\w*)[^\n]{0,40}/gi,
    " ",
  );
  const genericHp = firstMatchNumber(stripped, [/(\d{2,4})\s*(?:л\.?\s*с\.?|h\.?p\.?|PS)\b/i]);
  if (genericHp && genericHp >= 40 && genericHp <= 1500) return Math.round(genericHp);
  return null;
}

export function resolveUtilPower(input: {
  engineKind: QuickSearchEngineKind | null;
  layout: HybridLayout | null;
  icePowerHp: number | null;
  electricPowerHp: number | null;
}): { powerHp: number | null; note: string | null } {
  const { engineKind, layout, icePowerHp, electricPowerHp } = input;
  if (engineKind === "electric") {
    return {
      powerHp: electricPowerHp,
      note: electricPowerHp
        ? "Электромобиль: в калькулятор идёт 30-минутная мощность."
        : "Электромобиль: в источниках нет 30-минутной мощности.",
    };
  }
  if (engineKind === "ice") {
    return {
      powerHp: icePowerHp,
      note: icePowerHp ? "Бензин / дизель: объём и мощность ДВС." : null,
    };
  }
  if (engineKind === "hybrid" || engineKind === "phev") {
    if (layout === "parallel") {
      if (icePowerHp && electricPowerHp) {
        return {
          powerHp: icePowerHp + electricPowerHp,
          note: `Параллельный гибрид: мощность ДВС ${icePowerHp} л.с. + 30-минутная мощность электромотора ${electricPowerHp} л.с.`,
        };
      }
      const missing = [
        icePowerHp ? null : "мощность ДВС",
        electricPowerHp ? null : "30-минутная мощность электромотора",
      ].filter((item): item is string => Boolean(item));
      return {
        powerHp: null,
        note: `Параллельный гибрид. Не хватает: ${missing.join(", ")}.`,
      };
    }
    if (layout === "series") {
      return {
        powerHp: electricPowerHp,
        note: electricPowerHp
          ? "Последовательный гибрид: в мощность идёт 30-минутная мощность электромотора. Объём — у ДВС."
          : "Последовательный гибрид: в источниках нет 30-минутной мощности электромотора.",
      };
    }
    return {
      powerHp: null,
      note: "Гибрид: не удалось понять, последовательный он или параллельный. Для параллельного считается сумма мощности ДВС и 30-минутной мощности электромотора.",
    };
  }
  return { powerHp: icePowerHp ?? electricPowerHp, note: null };
}

function litersToCc(liters: number | null): number | null {
  if (!liters || liters < 0.6 || liters > 8) return null;
  return Math.round(liters * 1000);
}

function contextAround(text: string, index: number, radius = 48): string {
  return text.slice(Math.max(0, index - radius), Math.min(text.length, index + radius + 24));
}

function isFeeBracketContext(ctx: string): boolean {
  return /(?:до|свыше|более|менее|не\s+более|от)\s+\d(?:[.,]\d+)?\s*(?:до\s+\d(?:[.,]\d+)?\s*)?(?:л|L)\b/i.test(
    ctx,
  );
}

type VolumeHit = { cc: number; score: number; hadDecimal: boolean };

function addVolumeHits(text: string, pattern: RegExp, score: number, asLiters: boolean): VolumeHit[] {
  const hits: VolumeHit[] = [];
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const global = new RegExp(pattern.source, flags);
  for (const match of text.matchAll(global)) {
    if (match.index == null) continue;
    const ctx = contextAround(text, match.index);
    if (isFeeBracketContext(ctx)) continue;
    const token = match[1] ?? match[2] ?? "";
    const raw = asPositiveNumber(token);
    const cc = asLiters ? litersToCc(raw) : raw && raw >= 600 && raw <= 8000 ? Math.round(raw) : null;
    if (!cc) continue;
    hits.push({ cc, score, hadDecimal: /[.,]/.test(token) });
  }
  return hits;
}

function parseVolumeCcFromText(text: string): number | null {
  const hits: VolumeHit[] = [
    ...addVolumeHits(text, /(\d(?:[.,]\d{1,2})?)\s*-?\s*T\b/i, 100, true),
    ...addVolumeHits(text, /(\d(?:[.,]\d{1,2})?)\s*-?\s*литр(?:овый|а|ов)?/i, 90, true),
    ...addVolumeHits(
      text,
      /(?:двигател\w*|engine|displacement|объ[её]м\w*|turbo(?:charged)?)[^\n]{0,40}?(\d(?:[.,]\d{1,2})?)\s*(?:л(?![.\s]*с)|L\b|T\b)/i,
      80,
      true,
    ),
    ...addVolumeHits(text, /(\d{3,4})\s*(?:см[³3]|cc|куб\.?\s*см)/i, 70, false),
    ...addVolumeHits(text, /(\d(?:[.,]\d{1,2})?)\s*л(?![.\s]*с)/i, 20, true),
    ...addVolumeHits(text, /(\d(?:[.,]\d{1,2})?)\s*L\b/, 20, true),
  ];

  const ranked = hits
    .filter((hit) => {
      const liters = hit.cc / 1000;
      const wholeBracket =
        !hit.hadDecimal && (liters === 1 || liters === 2 || liters === 3 || liters === 4);
      if (wholeBracket && hit.score < 70) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score || b.cc - a.cc);

  return ranked[0]?.cc ?? null;
}

function parseOriginFromText(text: string): OriginCountry | null {
  const lower = text.toLowerCase();
  if (lower.includes("кыргыз") || lower.includes("киргиз")) return "kyrgyzstan";
  if (lower.includes("коре") || lower.includes("korea") || lower.includes("hyundai") || lower.includes("kia ")) {
    return "korea";
  }
  if (
    lower.includes("китай") ||
    lower.includes("china") ||
    lower.includes("zeekr") ||
    lower.includes("byd") ||
    lower.includes("trumpchi") ||
    lower.includes("gac") ||
    lower.includes("changan") ||
    lower.includes("geely") ||
    lower.includes("chery")
  ) {
    return "china";
  }
  return parseOrigin(text);
}

function parseTitleFromText(text: string): string | null {
  const labeled = text.match(
    /(?:авто(?:мобиль)?|модель|title)\s*[:—-]\s*([A-Za-zА-Яа-я0-9][A-Za-zА-Яа-я0-9 .+\-]{2,80})/i,
  );
  const value = asString(labeled?.[1]);
  if (value && !value.startsWith("{")) return value.slice(0, 120);
  return null;
}

function parseAgeFromText(text: string): CarAge | null {
  const lower = text.toLowerCase();
  if (/нов(?:ый|ого|ая)\s+авто|new car|возраст[:\s]+нов/.test(lower)) return "new";
  if (/до\s*3|младше\s*3|under\s*3|не старше 3/.test(lower)) return "under3";
  return null;
}

/** Строки таблицы «параметр — значение» важнее абзацев. */
function extractFromSpecTable(text: string): {
  volumeCc: number | null;
  icePowerHp: number | null;
  electricPowerHp: number | null;
} {
  let volumeCc: number | null = null;
  let icePowerHp: number | null = null;
  let electricPowerHp: number | null = null;

  for (const rawLine of text.split(/\n+/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (line.length < 4 || line.length > 220) continue;
    const lower = line.toLowerCase();

    if (
      !volumeCc &&
      /排量|displacement|рабочий объ[её]м|объ[её]м двигател|engine capacity|engine volume/i.test(line)
    ) {
      const liters = firstMatchNumber(line, [
        /(\d(?:[.,]\d{1,2})?)\s*(?:л(?![.\s]*с)|L\b|T\b)/i,
      ]);
      const cc = firstMatchNumber(line, [/(\d{3,4})\s*(?:см|cc|ml|毫升)/i]);
      volumeCc = litersToCc(liters) ?? (cc && cc >= 600 && cc <= 8000 ? Math.round(cc) : null);
    }

    if (
      !electricPowerHp &&
      /30[-\s]?мин|30[-\s]?min|получасов|半小时功率|30\s*分钟功率|unece\s*r?85/i.test(line)
    ) {
      electricPowerHp = parseThirtyMinutePowerHp(line);
    }

    if (
      !icePowerHp &&
      /发动机功率|мощность двс|ice power|engine power|rated power|макс(?:имальн)?\.?\s*мощность/i.test(
        lower,
      ) &&
      !/30[-\s]?мин|30[-\s]?min|半小时|电驱|motor power|системн|суммарн|combined/i.test(lower)
    ) {
      icePowerHp = parseIcePowerHp(line, true);
    }
  }

  return { volumeCc, icePowerHp, electricPowerHp };
}

export function textHasStrongEvOrPhevSignal(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\bphev\b/.test(lower) ||
    /plug-?in/.test(lower) ||
    lower.includes("插电") ||
    lower.includes("纯电") ||
    /\bbev\b/.test(lower) ||
    /электромобил/.test(lower) ||
    /battery electric|pure electric/.test(lower) ||
    /增程式|range extender|\berev\b|\breev\b/.test(lower)
  );
}

function textHasStrongIceSignal(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /gasoline|petrol|бензин|дизель|diesel|skylactiv|naturally aspirated|turbo petrol/.test(
      lower,
    ) || /发动机|内燃机|рабочий объ[её]м|displacement/.test(lower)
  );
}

function buildSpecsForKind(
  text: string,
  forcedKind: QuickSearchEngineKind | null,
): Partial<QuickSearchSuggestion> {
  const fromTable = extractFromSpecTable(text);
  const volumeCcRaw = fromTable.volumeCc ?? parseVolumeCcFromText(text);
  let engineKind = forcedKind ?? detectEngineKindFromText(text);
  const electricPowerHp =
    engineKind === "ice"
      ? null
      : fromTable.electricPowerHp ?? parseThirtyMinutePowerHp(text);

  if (
    !forcedKind &&
    volumeCcRaw &&
    engineKind &&
    engineKind !== "ice" &&
    !textHasStrongEvOrPhevSignal(text.slice(0, 2_500)) &&
    (textHasStrongIceSignal(text) || fromTable.icePowerHp)
  ) {
    engineKind = "ice";
  }
  if (!engineKind && electricPowerHp && !volumeCcRaw) {
    engineKind = "electric";
  }
  if (!engineKind && volumeCcRaw) {
    engineKind = "ice";
  }

  const layout =
    engineKind === "hybrid" || engineKind === "phev" ? detectHybridLayout(text) : null;
  const icePowerHp =
    fromTable.icePowerHp ??
    parseIcePowerHp(text, engineKind === "ice" || engineKind == null || engineKind === "phev");
  const resolved = resolveUtilPower({
    engineKind,
    layout,
    icePowerHp: engineKind === "electric" ? null : icePowerHp,
    electricPowerHp: engineKind === "ice" ? null : electricPowerHp,
  });
  const engine = parseEngine(null, engineKind);
  const markers = extractTrimMarkersFromText(text);
  return {
    title: parseTitleFromText(text),
    originCountry: parseOriginFromText(text),
    engineKind,
    hybridLayout: engineKind === "ice" || engineKind === "electric" ? null : layout,
    engine,
    powerHp: resolved.powerHp,
    icePowerHp: engineKind === "electric" ? null : icePowerHp,
    electricPowerHp: engineKind === "ice" ? null : electricPowerHp,
    volumeCc: engine === "electric" ? null : volumeCcRaw,
    batteryRangeKm: engineKind === "ice" ? null : markers.batteryRangeKm,
    drivetrain: markers.drivetrain,
    // У принудительного ICE с смешанной страницы не тащим PHEV-издания (Plus/LiDAR).
    trimTags:
      forcedKind === "ice"
        ? null
        : markers.trimTags.length > 0
          ? markers.trimTags
          : null,
    age: parseAgeFromText(text),
    note: resolved.note,
  };
}

export function extractSpecsFromDocument(text: string): Partial<QuickSearchSuggestion> {
  return buildSpecsForKind(text, null);
}

/**
 * Одна страница часто описывает и бензин, и PHEV (Mazda CX-5 China).
 * Тогда отдаём оба варианта, чтобы 2.0 л не терялся.
 */
export function extractSpecsVariantsFromDocument(
  text: string,
): Array<Partial<QuickSearchSuggestion>> {
  const primary = buildSpecsForKind(text, null);
  const hasIceEvidence =
    Boolean(primary.volumeCc) ||
    textHasStrongIceSignal(text) ||
    /\b2\.[05]\s*l\b|\b2\.[05]t\b|skylactiv|汽油|燃油/i.test(text);
  const hasPhevEvidence = textHasStrongEvOrPhevSignal(text);

  if (hasIceEvidence && hasPhevEvidence) {
    const ice = buildSpecsForKind(text, "ice");
    const phev = buildSpecsForKind(text, "phev");
    const variants: Array<Partial<QuickSearchSuggestion>> = [];
    if (ice.volumeCc || ice.icePowerHp || ice.powerHp) variants.push(ice);
    if (phev.engineKind === "phev") variants.push(phev);
    if (variants.length > 0) return variants;
  }

  return [primary];
}

export function mergeSuggestionWithDocs(
  base: QuickSearchSuggestion,
  docs: SpecDocumentLike[],
  userQuery: string,
): QuickSearchSuggestion {
  const patch = assemblePartialFromDocs(docs, userQuery);
  const engineKind = base.engineKind ?? patch.engineKind ?? null;
  const isElectric = engineKind === "electric";
  const hybridLayout = isElectric ? null : base.hybridLayout ?? patch.hybridLayout ?? null;
  const icePowerHp = isElectric ? null : base.icePowerHp ?? patch.icePowerHp ?? null;
  const electricPowerHp = base.electricPowerHp ?? patch.electricPowerHp ?? null;
  const volumeCc = isElectric ? null : base.volumeCc ?? patch.volumeCc ?? null;
  const resolved = resolveUtilPower({
    engineKind,
    layout: hybridLayout,
    icePowerHp,
    electricPowerHp,
  });
  const engine =
    engineKind === "electric"
      ? "electric"
      : volumeCc || engineKind === "hybrid" || engineKind === "phev" || engineKind === "ice"
        ? "petrol"
        : base.engine ?? patch.engine ?? null;

  return withHybridNote({
    title: base.title ?? patch.title ?? titleFromUserQuery(userQuery),
    originCountry: base.originCountry ?? patch.originCountry ?? null,
    engineKind,
    hybridLayout,
    engine,
    powerHp: resolved.powerHp,
    icePowerHp,
    electricPowerHp,
    volumeCc,
    batteryRangeKm: base.batteryRangeKm ?? patch.batteryRangeKm ?? null,
    drivetrain: base.drivetrain ?? patch.drivetrain ?? null,
    trimTags: base.trimTags ?? patch.trimTags ?? null,
    price: base.price ?? patch.price ?? null,
    currency: base.currency ?? patch.currency ?? null,
    age: base.age ?? patch.age ?? null,
    importer: base.importer ?? patch.importer ?? null,
    note: resolved.note,
  });
}

type SpecDocumentLike = { text: string; title: string | null; url?: string | null };

function assemblePartialFromDocs(
  docs: SpecDocumentLike[],
  userQuery: string,
): Partial<QuickSearchSuggestion> {
  const merged = docs
    .map((doc) => extractSpecsFromDocument([doc.title, doc.text].filter(Boolean).join("\n")))
    .reduce<Partial<QuickSearchSuggestion>>((acc, specs) => {
      return {
        title: acc.title ?? specs.title ?? null,
        originCountry: acc.originCountry ?? specs.originCountry ?? null,
        engineKind: acc.engineKind ?? specs.engineKind ?? null,
        hybridLayout: acc.hybridLayout ?? specs.hybridLayout ?? null,
        engine: acc.engine ?? specs.engine ?? null,
        icePowerHp: acc.icePowerHp ?? specs.icePowerHp ?? null,
        electricPowerHp: acc.electricPowerHp ?? specs.electricPowerHp ?? null,
        volumeCc: acc.volumeCc ?? specs.volumeCc ?? null,
        batteryRangeKm: acc.batteryRangeKm ?? specs.batteryRangeKm ?? null,
        drivetrain: acc.drivetrain ?? specs.drivetrain ?? null,
        trimTags: acc.trimTags ?? specs.trimTags ?? null,
        age: acc.age ?? specs.age ?? null,
        price: acc.price ?? specs.price ?? null,
        currency: acc.currency ?? specs.currency ?? null,
        importer: acc.importer ?? specs.importer ?? null,
        note: acc.note ?? specs.note ?? null,
        powerHp: acc.powerHp ?? specs.powerHp ?? null,
      };
    }, {});
  if (!merged.title) merged.title = titleFromUserQuery(userQuery);
  return merged;
}

function parseFromUnstructured(text: string): Partial<QuickSearchSuggestion> {
  return extractSpecsFromDocument(text);
}

export function withHybridNote(suggestion: QuickSearchSuggestion): QuickSearchSuggestion {
  if (suggestion.engineKind === "ice") {
    return {
      ...suggestion,
      hybridLayout: null,
      electricPowerHp: null,
      batteryRangeKm: null,
      note:
        suggestion.note && /30-минут|электромотор|гибрид/i.test(suggestion.note)
          ? null
          : suggestion.note,
    };
  }
  if (suggestion.note) return suggestion;
  const resolved = resolveUtilPower({
    engineKind: suggestion.engineKind,
    layout: suggestion.hybridLayout,
    icePowerHp: suggestion.icePowerHp,
    electricPowerHp: suggestion.electricPowerHp,
  });
  return resolved.note ? { ...suggestion, note: resolved.note } : suggestion;
}

export function parseCalculatorSuggestion(
  answer: string,
  sources: Array<{ answer: string; sourceTitle: string | null }>,
  userQuery = "",
): QuickSearchSuggestion | null {
  const sourceBlob = sources
    .map((item) => [item.sourceTitle, item.answer].filter(Boolean).join("\n"))
    .join("\n");
  const json = extractJsonObject(answer) ?? extractJsonObject(sourceBlob);
  const prose = [stripJsonBlocks(answer), sourceBlob, userQuery].filter(Boolean).join("\n");
  const fromText = parseFromUnstructured(prose);

  const jsonTrusted = Boolean(json) && !jsonLooksLikeTemplate(json!);
  const jsonNumbersOk =
    jsonTrusted &&
    (!jsonLooksLikeDefaultNumbers(json!) ||
      (textConfirmsPower(prose, 150) && textConfirmsVolume(prose, 2000)));

  const engineKind =
    fromText.engineKind ??
    (jsonTrusted ? parseEngineKind(json?.engineKind ?? json?.engine_kind) : null) ??
    null;
  const engine = parseEngine(jsonTrusted ? json?.engine : null, engineKind) ?? fromText.engine ?? null;

  let powerHp = jsonNumbersOk ? asPositiveNumber(json?.powerHp ?? json?.power_hp) : null;
  powerHp = powerHp ?? fromText.powerHp ?? null;

  let volumeCc = engine === "electric" ? null : fromText.volumeCc ?? null;
  const jsonVolume = jsonNumbersOk ? asPositiveNumber(json?.volumeCc ?? json?.volume_cc) : null;
  const jsonVolumeLooksLikeFeeBracket =
    jsonVolume === 1000 || jsonVolume === 2000 || jsonVolume === 3000 || jsonVolume === 4000;
  if (engine !== "electric" && !volumeCc && jsonVolume && !jsonVolumeLooksLikeFeeBracket) {
    volumeCc = jsonVolume;
  }

  const jsonTitle = jsonTrusted ? asString(json?.title) : null;
  const title =
    (jsonTitle && !isPlaceholderTitle(jsonTitle) ? jsonTitle : null) ??
    fromText.title ??
    titleFromUserQuery(userQuery);
  const note = jsonTrusted ? asString(json?.note) : null;

  if (!engine && !powerHp && !volumeCc && !title) return null;

  return withHybridNote({
    title,
    originCountry:
      fromText.originCountry ??
      (jsonTrusted ? parseOrigin(json?.originCountry ?? json?.origin_country) : null) ??
      null,
    engineKind,
    hybridLayout: fromText.hybridLayout ?? null,
    engine,
    powerHp: powerHp ? Math.round(powerHp) : null,
    icePowerHp: fromText.icePowerHp ?? null,
    electricPowerHp: fromText.electricPowerHp ?? null,
    volumeCc: volumeCc ? Math.round(volumeCc) : null,
    batteryRangeKm: fromText.batteryRangeKm ?? null,
    drivetrain: fromText.drivetrain ?? null,
    trimTags: fromText.trimTags ?? null,
    price: jsonTrusted ? asPositiveNumber(json?.price) : null,
    currency: jsonTrusted ? parseCurrency(json?.currency) : null,
    age: fromText.age ?? (jsonTrusted ? parseAge(json?.age) : null) ?? null,
    importer: jsonTrusted ? parseImporter(json?.importer) : null,
    note,
  });
}

export function canApplyCalculatorSuggestion(suggestion: QuickSearchSuggestion): boolean {
  return missingCalculatorData(suggestion).length === 0;
}

/** Чего не хватает, чтобы перенести расчёт в калькулятор. */
export function missingCalculatorData(suggestion: QuickSearchSuggestion | null): string[] {
  if (!suggestion) {
    return ["тип двигателя", "объём и мощность двигателя"];
  }

  const missing: string[] = [];
  const isIce = suggestion.engineKind === "ice";
  const isHybrid = suggestion.engineKind === "hybrid" || suggestion.engineKind === "phev";
  const isElectric = suggestion.engine === "electric" || suggestion.engineKind === "electric";

  if (!suggestion.engineKind && !suggestion.engine) {
    missing.push("тип двигателя");
  }

  // Бензин/дизель: только объём и мощность ДВС. 30-минутную мощность не ищем.
  if (isIce) {
    if (!suggestion.icePowerHp && !suggestion.powerHp) {
      missing.push("мощность двигателя в л.с.");
    }
    if (!suggestion.volumeCc) missing.push("объём двигателя");
    return missing;
  }

  if (isHybrid && !suggestion.hybridLayout) {
    missing.push("вид гибрида: последовательный или параллельный");
  }

  if (isElectric) {
    if (!suggestion.electricPowerHp && !suggestion.powerHp) {
      missing.push("30-минутная мощность");
    }
    return missing;
  }

  if (isHybrid && suggestion.hybridLayout === "parallel") {
    if (!suggestion.icePowerHp) missing.push("мощность ДВС");
    if (!suggestion.electricPowerHp) missing.push("30-минутная мощность электромотора");
  } else if (isHybrid && suggestion.hybridLayout === "series") {
    if (!suggestion.electricPowerHp && !suggestion.powerHp) {
      missing.push("30-минутная мощность электромотора");
    }
  } else if (isHybrid) {
    if (!suggestion.icePowerHp) missing.push("мощность ДВС");
    if (!suggestion.electricPowerHp) missing.push("30-минутная мощность электромотора");
  } else if (!suggestion.icePowerHp && !suggestion.powerHp) {
    missing.push("мощность двигателя в л.с.");
  }

  if (!isElectric && !suggestion.volumeCc) missing.push("объём двигателя");
  return missing;
}

export function engineKindLabel(kind: QuickSearchEngineKind | null): string | null {
  if (kind === "hybrid") return "гибрид";
  if (kind === "phev") return "подключаемый гибрид";
  if (kind === "electric") return "электро";
  if (kind === "ice") return "ДВС";
  return null;
}
