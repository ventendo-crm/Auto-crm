import type {
  CarAge,
  CurrencyCode,
  EngineType,
  ImporterType,
  OriginCountry,
} from "../customs-calculator/rates";

export type QuickSearchEngineKind = "ice" | "hybrid" | "phev" | "electric";

export type QuickSearchSuggestion = {
  title: string | null;
  originCountry: OriginCountry | null;
  engineKind: QuickSearchEngineKind | null;
  engine: EngineType | null;
  powerHp: number | null;
  volumeCc: number | null;
  price: number | null;
  currency: CurrencyCode | null;
  age: CarAge | null;
  importer: ImporterType | null;
  note: string | null;
};

export function buildCalculatorSearchQuery(userQuery: string): string {
  return `${userQuery.trim()}

Нужны характеристики для расчёта растаможки и утильсбора легкового авто в РФ.
Для гибрида, PHEV и range extender бери мощность и объём ДВС — не электромотор и не суммарную мощность.
Для электромобиля бери 30-минутную мощность в лошадиных силах.

Ответ на русском. В конце выведи JSON без markdown:
{"title":"марка модель","originCountry":"china","engineKind":"hybrid","engine":"petrol","powerHp":150,"volumeCc":2000,"price":null,"currency":null,"age":"new","note":"для гибрида в расчёт взята мощность ДВС"}
originCountry: china | korea | kyrgyzstan | null
engineKind: ice | hybrid | phev | electric | null
engine: petrol | diesel | electric | null — для гибрида petrol или diesel
age: new | under3 | null
currency: CNY | USD | KRW | RUB | null
Если данных нет — null.`;
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
    const match = text.match(pattern);
    const raw = match?.[1] ?? match?.[2];
    const value = asPositiveNumber(raw);
    if (value) return value;
  }
  return null;
}

function detectEngineKindFromText(text: string): QuickSearchEngineKind | null {
  const lower = text.toLowerCase();
  if (
    lower.includes("phev") ||
    lower.includes("plug-in") ||
    lower.includes("plugin") ||
    lower.includes("подключаем")
  ) {
    return "phev";
  }
  if (
    lower.includes("hybrid") ||
    lower.includes("гибрид") ||
    lower.includes("range extender") ||
    lower.includes("удлинител") ||
    lower.includes("rehv") ||
    lower.includes("er ev") ||
    lower.includes("e-rev")
  ) {
    return "hybrid";
  }
  if (
    /\bbev\b/.test(lower) ||
    lower.includes("электромобил") ||
    lower.includes("electric vehicle") ||
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

function parsePowerHpFromText(text: string, kind: QuickSearchEngineKind | null): number | null {
  if (kind === "electric") {
    const thirtyMinHp = firstMatchNumber(text, [
      /30[-\s]?мин(?:утн\w*)?[^\n]{0,50}?(\d{2,4})\s*(?:л\.?\s*с\.?|hp)/i,
      /(\d{2,4})\s*(?:л\.?\s*с\.?|hp)[^\n]{0,40}?30[-\s]?мин/i,
    ]);
    if (thirtyMinHp) return Math.round(thirtyMinHp);
    const thirtyMinKw = firstMatchNumber(text, [
      /30[-\s]?мин(?:утн\w*)?[^\n]{0,50}?(\d{2,4}(?:[.,]\d+)?)\s*кВт/i,
      /(\d{2,4}(?:[.,]\d+)?)\s*кВт[^\n]{0,40}?30[-\s]?мин/i,
    ]);
    if (thirtyMinKw) return kwToHp(thirtyMinKw);
  }

  if (kind === "hybrid" || kind === "phev") {
    const iceHp = firstMatchNumber(text, [
      /(?:ДВС|ICE|бензин(?:овый)?(?:\s+двигатель)?|petrol(?:\s+engine)?)[^\n]{0,50}?(\d{2,4})\s*(?:л\.?\s*с\.?|hp)/i,
      /(\d{2,4})\s*(?:л\.?\s*с\.?|hp)[^\n]{0,40}?(?:ДВС|ICE|бензин)/i,
      /мощность\s+ДВС[^\n]{0,20}?(\d{2,4})/i,
    ]);
    if (iceHp) return Math.round(iceHp);
    const iceKw = firstMatchNumber(text, [
      /(?:ДВС|ICE|бензин(?:овый)?)[^\n]{0,50}?(\d{2,3}(?:[.,]\d+)?)\s*кВт/i,
    ]);
    if (iceKw) return kwToHp(iceKw);
  }

  const stripped = text.replace(
    /(?:суммарн\w*|системн\w*|combined|общая\s+мощност\w*|электромотор\w*|electric motor)[^\n]{0,40}/gi,
    " ",
  );
  const genericHp = firstMatchNumber(stripped, [
    /(\d{2,4})\s*(?:л\.?\s*с\.?|h\.?p\.?)\b/i,
  ]);
  if (genericHp && genericHp >= 40 && genericHp <= 1500) return Math.round(genericHp);
  return null;
}

function parseVolumeCcFromText(text: string): number | null {
  const cc = firstMatchNumber(text, [
    /(\d{3,4})\s*(?:см[³3]|cc|куб\.?\s*см)/i,
    /объ[её]м[^\n]{0,24}?(\d{3,4})/i,
  ]);
  if (cc && cc >= 600 && cc <= 8000) return Math.round(cc);

  const liters = firstMatchNumber(text, [
    /(\d{1,2}(?:[.,]\d{1,2})?)\s*л(?![.\s]*с)/i,
    /(\d{1,2}(?:[.,]\d{1,2})?)\s*L\b/,
  ]);
  if (liters && liters >= 0.6 && liters <= 8) return Math.round(liters * 1000);
  return null;
}

function parseOriginFromText(text: string): OriginCountry | null {
  const lower = text.toLowerCase();
  if (lower.includes("кыргыз") || lower.includes("киргиз")) return "kyrgyzstan";
  if (lower.includes("коре") || lower.includes("korea") || lower.includes("hyundai") || lower.includes("kia ")) {
    return "korea";
  }
  if (lower.includes("китай") || lower.includes("china") || lower.includes("zeekr") || lower.includes("byd")) {
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

function parseFromUnstructured(text: string): Partial<QuickSearchSuggestion> {
  const engineKind = detectEngineKindFromText(text);
  const engine = parseEngine(null, engineKind);
  const volumeCc = engine === "electric" ? null : parseVolumeCcFromText(text);
  return {
    title: parseTitleFromText(text),
    originCountry: parseOriginFromText(text),
    engineKind,
    engine,
    powerHp: parsePowerHpFromText(text, engineKind),
    volumeCc,
    age: parseAgeFromText(text),
  };
}

function withHybridNote(suggestion: QuickSearchSuggestion): QuickSearchSuggestion {
  if (suggestion.note) return suggestion;
  if (suggestion.engineKind === "hybrid" || suggestion.engineKind === "phev") {
    return {
      ...suggestion,
      note: "Для гибрида в калькулятор берутся мощность и объём ДВС, не электромотор и не суммарная мощность.",
    };
  }
  if (suggestion.engineKind === "electric") {
    return {
      ...suggestion,
      note: "Для электромобиля в утильсбор идёт 30-минутная мощность.",
    };
  }
  return suggestion;
}

export function parseCalculatorSuggestion(
  answer: string,
  sources: Array<{ answer: string; sourceTitle: string | null }>,
): QuickSearchSuggestion | null {
  const blob = [answer, ...sources.map((item) => item.answer)].filter(Boolean).join("\n");
  const json = extractJsonObject(blob);
  const fromText = parseFromUnstructured(blob);

  const engineKind = parseEngineKind(json?.engineKind ?? json?.engine_kind) ?? fromText.engineKind ?? null;
  const engine = parseEngine(json?.engine, engineKind) ?? fromText.engine ?? null;
  const powerHp = asPositiveNumber(json?.powerHp ?? json?.power_hp) ?? fromText.powerHp ?? null;
  const volumeCc =
    engine === "electric"
      ? null
      : asPositiveNumber(json?.volumeCc ?? json?.volume_cc) ?? fromText.volumeCc ?? null;
  const title = asString(json?.title) ?? fromText.title ?? null;
  const note = asString(json?.note) ?? null;

  if (!engine && !powerHp && !volumeCc && !title) return null;

  return withHybridNote({
    title,
    originCountry: parseOrigin(json?.originCountry ?? json?.origin_country) ?? fromText.originCountry ?? null,
    engineKind,
    engine,
    powerHp: powerHp ? Math.round(powerHp) : null,
    volumeCc: volumeCc ? Math.round(volumeCc) : null,
    price: asPositiveNumber(json?.price) ?? null,
    currency: parseCurrency(json?.currency),
    age: parseAge(json?.age) ?? fromText.age ?? null,
    importer: parseImporter(json?.importer),
    note,
  });
}

export function canApplyCalculatorSuggestion(suggestion: QuickSearchSuggestion): boolean {
  if (!suggestion.engine || !suggestion.powerHp) return false;
  if (suggestion.engine !== "electric" && !suggestion.volumeCc) return false;
  return true;
}

export function engineKindLabel(kind: QuickSearchEngineKind | null): string | null {
  if (kind === "hybrid") return "гибрид";
  if (kind === "phev") return "подключаемый гибрид";
  if (kind === "electric") return "электро";
  if (kind === "ice") return "ДВС";
  return null;
}
