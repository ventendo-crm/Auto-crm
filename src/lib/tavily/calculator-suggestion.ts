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
  price: number | null;
  currency: CurrencyCode | null;
  age: CarAge | null;
  importer: ImporterType | null;
  note: string | null;
};

/** Фиксированная задача: менеджер вводит только марку и модель. */
export const UTIL_SEARCH_TEMPLATE =
  "Рассчитай утильсбор для импорта автомобиля в Россию";

/** Короткий запрос в поиск: спецификации ДВС и 30-минутная мощность электро, без таблиц утильсбора. */
export function buildSpecRetrievalQuery(userQuery: string): string {
  const model = userQuery.trim();
  return `${model} petrol diesel hybrid PHEV series parallel range extender EREV 30-minute power horsepower displacement 增程式 串联 并联 半小时功率 排量 功率 发动机 混动 纯电 объём ДВС мощность`;
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

function detectEngineKindFromText(text: string): QuickSearchEngineKind | null {
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
    lower.includes("hybrid") ||
    lower.includes("гибрид") ||
    lower.includes("混动") ||
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
    lower.includes("纯电") ||
    lower.includes("电动汽车") ||
    (lower.includes("электро") && !lower.includes("гибрид")) ||
    /30[-\s]?мин(?:утн)?|30[-\s]?minute|半小时功率|30\s*分钟功率/.test(lower)
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

export function extractSpecsFromDocument(text: string): Partial<QuickSearchSuggestion> {
  const electricPowerHp = parseThirtyMinutePowerHp(text);
  let engineKind = detectEngineKindFromText(text);
  const volumeCcRaw = parseVolumeCcFromText(text);
  if (!engineKind && electricPowerHp && !volumeCcRaw) {
    engineKind = "electric";
  }
  if (!engineKind && volumeCcRaw) {
    engineKind = "ice";
  }
  const layout =
    engineKind === "hybrid" || engineKind === "phev" ? detectHybridLayout(text) : null;
  const icePowerHp = parseIcePowerHp(text, engineKind === "ice" || engineKind == null);
  const resolved = resolveUtilPower({
    engineKind,
    layout,
    icePowerHp,
    electricPowerHp,
  });
  const engine = parseEngine(null, engineKind);
  return {
    title: parseTitleFromText(text),
    originCountry: parseOriginFromText(text),
    engineKind,
    hybridLayout: layout,
    engine,
    powerHp: resolved.powerHp,
    icePowerHp,
    electricPowerHp,
    volumeCc: engine === "electric" ? null : volumeCcRaw,
    age: parseAgeFromText(text),
    note: resolved.note,
  };
}

function parseFromUnstructured(text: string): Partial<QuickSearchSuggestion> {
  return extractSpecsFromDocument(text);
}

export function withHybridNote(suggestion: QuickSearchSuggestion): QuickSearchSuggestion {
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
    return ["тип двигателя", "объём ДВС или 30-минутная мощность"];
  }

  const missing: string[] = [];
  const isHybrid = suggestion.engineKind === "hybrid" || suggestion.engineKind === "phev";
  const isElectric = suggestion.engine === "electric" || suggestion.engineKind === "electric";

  if (!suggestion.engineKind && !suggestion.engine) {
    missing.push("тип двигателя");
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

  if (!suggestion.volumeCc) missing.push("объём двигателя");
  return missing;
}

export function engineKindLabel(kind: QuickSearchEngineKind | null): string | null {
  if (kind === "hybrid") return "гибрид";
  if (kind === "phev") return "подключаемый гибрид";
  if (kind === "electric") return "электро";
  if (kind === "ice") return "ДВС";
  return null;
}
