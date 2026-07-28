"use client";

import { Calculator as CalculatorIcon, FileDown, ImageDown, Loader2, RefreshCw, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { SaveEstimateToDealButton } from "@/components/calculator/save-estimate-to-deal-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import {
  calculateCustoms,
  CarAge,
  CurrencyCode,
  CustomsCalculatorInput,
  DEFAULT_BROKER_FEE_RUB,
  DEFAULT_DELIVERY_RUB,
  DEFAULT_ESCORT_RUB,
  DEFAULT_EXCHANGE_RATES,
  DEFAULT_KOREA_BROKER_FEE_RUB,
  DEFAULT_KOREA_DELIVERY_RUB,
  DEFAULT_KOREA_DOCS_DELIVERY_KRW,
  DEFAULT_KOREA_PARKING_FEE_KRW,
  DeliveryRoute,
  EngineType,
  ExchangeRates,
  ImporterType,
  KAZAKHSTAN_DELIVERY_USD,
  OriginCountry,
  PREFERENTIAL_MAX_HP_EV,
  PREFERENTIAL_MAX_HP_ICE,
  PREFERENTIAL_MAX_VOLUME_CC,
  RECYCLING_BASE_PASSENGER,
  roundExchangeRate,
  roundExchangeRates,
} from "@/lib/customs-calculator";
import { cn, formatCurrency } from "@/lib/utils";

const STORAGE_KEY = "autocrm-customs-calculator";
const HISTORY_STORAGE_KEY = "autocrm-customs-calculator-history";
const PRESETS_STORAGE_KEY = "autocrm-customs-calculator-presets";
const MAX_USER_PRESETS = 12;

type CalculatorPersistedState = {
  originCountry: OriginCountry;
  importer: ImporterType;
  age: CarAge;
  engine: EngineType;
  powerHp: string;
  volumeCc: string;
  price: string;
  currency: CurrencyCode;
  chinaExpensesCny: string;
  koreaDocsDeliveryKrw: string;
  parkingFeeKrw: string;
  brokerFeeRub: string;
  deliveryRoute: DeliveryRoute;
  deliveryRub: string;
  deliveryUsd: string;
  escortRub: string;
  rates: ExchangeRates;
  ratesUpdatedAt: string | null;
  submitted: boolean;
};

type CalculatorHistoryItem = CalculatorPersistedState & {
  id: string;
  savedAt: string;
  totalWithCar: number;
};

type UserPreset = {
  id: string;
  name: string;
  savedAt: string;
  originCountry: OriginCountry;
  importer: ImporterType;
  age: CarAge;
  engine: EngineType;
  powerHp: string;
  volumeCc: string;
  price: string;
  currency: CurrencyCode;
  chinaExpensesCny: string;
  koreaDocsDeliveryKrw: string;
  parkingFeeKrw: string;
  brokerFeeRub: string;
  deliveryRoute: DeliveryRoute;
  deliveryRub: string;
  deliveryUsd: string;
  escortRub: string;
  rates: ExchangeRates;
};

const DEFAULT_STATE: CalculatorPersistedState = {
  originCountry: "china",
  importer: "personal",
  age: "under3",
  engine: "petrol",
  powerHp: "150",
  volumeCc: "2000",
  price: "25000",
  currency: "CNY",
  chinaExpensesCny: "5000",
  koreaDocsDeliveryKrw: String(DEFAULT_KOREA_DOCS_DELIVERY_KRW),
  parkingFeeKrw: String(DEFAULT_KOREA_PARKING_FEE_KRW),
  brokerFeeRub: String(DEFAULT_BROKER_FEE_RUB),
  deliveryRoute: "ussuriysk",
  deliveryRub: String(DEFAULT_DELIVERY_RUB),
  deliveryUsd: String(KAZAKHSTAN_DELIVERY_USD),
  escortRub: String(DEFAULT_ESCORT_RUB),
  rates: DEFAULT_EXCHANGE_RATES,
  ratesUpdatedAt: null,
  submitted: false,
};

function isImporter(value: unknown): value is ImporterType {
  return value === "personal" || value === "resale" || value === "legal";
}

function isAge(value: unknown): value is CarAge {
  return value === "under3" || value === "from3to5" || value === "from5to7" || value === "over7";
}

function isEngine(value: unknown): value is EngineType {
  return value === "petrol" || value === "diesel" || value === "electric";
}

function normalizeEngine(value: EngineType): EngineType {
  // Бензин и дизель объединены в одну кнопку UI
  return value === "diesel" ? "petrol" : value;
}

function isCurrency(value: unknown): value is CurrencyCode {
  return value === "RUB" || value === "USD" || value === "CNY" || value === "KRW";
}

function isDeliveryRoute(value: unknown): value is DeliveryRoute {
  return value === "ussuriysk" || value === "kazakhstan" || value === "vladivostok";
}

function isOriginCountry(value: unknown): value is OriginCountry {
  return value === "china" || value === "korea";
}

function loadPersistedState(): CalculatorPersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<CalculatorPersistedState>;
    const rates = roundExchangeRates({
      ...DEFAULT_EXCHANGE_RATES,
      USD: typeof parsed.rates?.USD === "number" ? parsed.rates.USD : DEFAULT_EXCHANGE_RATES.USD,
      EUR: typeof parsed.rates?.EUR === "number" ? parsed.rates.EUR : DEFAULT_EXCHANGE_RATES.EUR,
      CNY: typeof parsed.rates?.CNY === "number" ? parsed.rates.CNY : DEFAULT_EXCHANGE_RATES.CNY,
      KRW: typeof parsed.rates?.KRW === "number" ? parsed.rates.KRW : DEFAULT_EXCHANGE_RATES.KRW,
    });
    return {
      originCountry: isOriginCountry(parsed.originCountry)
        ? parsed.originCountry
        : DEFAULT_STATE.originCountry,
      importer: isImporter(parsed.importer) ? parsed.importer : DEFAULT_STATE.importer,
      age: isAge(parsed.age) ? parsed.age : DEFAULT_STATE.age,
      engine: isEngine(parsed.engine) ? normalizeEngine(parsed.engine) : DEFAULT_STATE.engine,
      powerHp: typeof parsed.powerHp === "string" ? parsed.powerHp : DEFAULT_STATE.powerHp,
      volumeCc: typeof parsed.volumeCc === "string" ? parsed.volumeCc : DEFAULT_STATE.volumeCc,
      price: typeof parsed.price === "string" ? parsed.price : DEFAULT_STATE.price,
      currency: isCurrency(parsed.currency) ? parsed.currency : DEFAULT_STATE.currency,
      chinaExpensesCny:
        typeof parsed.chinaExpensesCny === "string"
          ? parsed.chinaExpensesCny
          : DEFAULT_STATE.chinaExpensesCny,
      koreaDocsDeliveryKrw:
        typeof parsed.koreaDocsDeliveryKrw === "string"
          ? parsed.koreaDocsDeliveryKrw
          : DEFAULT_STATE.koreaDocsDeliveryKrw,
      parkingFeeKrw:
        typeof parsed.parkingFeeKrw === "string"
          ? parsed.parkingFeeKrw
          : DEFAULT_STATE.parkingFeeKrw,
      brokerFeeRub:
        typeof parsed.brokerFeeRub === "string" ? parsed.brokerFeeRub : DEFAULT_STATE.brokerFeeRub,
      deliveryRoute: isDeliveryRoute(parsed.deliveryRoute)
        ? parsed.deliveryRoute
        : DEFAULT_STATE.deliveryRoute,
      deliveryRub:
        typeof parsed.deliveryRub === "string" ? parsed.deliveryRub : DEFAULT_STATE.deliveryRub,
      deliveryUsd:
        typeof parsed.deliveryUsd === "string" ? parsed.deliveryUsd : DEFAULT_STATE.deliveryUsd,
      escortRub: typeof parsed.escortRub === "string" ? parsed.escortRub : DEFAULT_STATE.escortRub,
      rates,
      ratesUpdatedAt:
        typeof parsed.ratesUpdatedAt === "string" ? parsed.ratesUpdatedAt : DEFAULT_STATE.ratesUpdatedAt,
      submitted: Boolean(parsed.submitted),
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function savePersistedState(state: CalculatorPersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage недоступен
  }
}

function loadCalculatorHistory(): CalculatorHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CalculatorHistoryItem[]) : [];
  } catch {
    return [];
  }
}

function saveCalculatorHistory(items: CalculatorHistoryItem[]) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items.slice(0, 8)));
  } catch {
    // localStorage недоступен
  }
}

function loadUserPresets(): UserPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
      .map((item) => {
        const rates = roundExchangeRates({
          ...DEFAULT_EXCHANGE_RATES,
          USD: typeof item.rates === "object" && item.rates && typeof (item.rates as ExchangeRates).USD === "number"
            ? (item.rates as ExchangeRates).USD
            : DEFAULT_EXCHANGE_RATES.USD,
          EUR: typeof item.rates === "object" && item.rates && typeof (item.rates as ExchangeRates).EUR === "number"
            ? (item.rates as ExchangeRates).EUR
            : DEFAULT_EXCHANGE_RATES.EUR,
          CNY: typeof item.rates === "object" && item.rates && typeof (item.rates as ExchangeRates).CNY === "number"
            ? (item.rates as ExchangeRates).CNY
            : DEFAULT_EXCHANGE_RATES.CNY,
          KRW: typeof item.rates === "object" && item.rates && typeof (item.rates as ExchangeRates).KRW === "number"
            ? (item.rates as ExchangeRates).KRW
            : DEFAULT_EXCHANGE_RATES.KRW,
        });
        return {
          id: typeof item.id === "string" ? item.id : `${Date.now()}`,
          name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Без названия",
          savedAt: typeof item.savedAt === "string" ? item.savedAt : new Date().toISOString(),
          originCountry: isOriginCountry(item.originCountry)
            ? item.originCountry
            : DEFAULT_STATE.originCountry,
          importer: isImporter(item.importer) ? item.importer : DEFAULT_STATE.importer,
          age: isAge(item.age) ? item.age : DEFAULT_STATE.age,
          engine: isEngine(item.engine) ? normalizeEngine(item.engine) : DEFAULT_STATE.engine,
          powerHp: typeof item.powerHp === "string" ? item.powerHp : DEFAULT_STATE.powerHp,
          volumeCc: typeof item.volumeCc === "string" ? item.volumeCc : DEFAULT_STATE.volumeCc,
          price: typeof item.price === "string" ? item.price : DEFAULT_STATE.price,
          currency: isCurrency(item.currency) ? item.currency : DEFAULT_STATE.currency,
          chinaExpensesCny:
            typeof item.chinaExpensesCny === "string"
              ? item.chinaExpensesCny
              : DEFAULT_STATE.chinaExpensesCny,
          koreaDocsDeliveryKrw:
            typeof item.koreaDocsDeliveryKrw === "string"
              ? item.koreaDocsDeliveryKrw
              : DEFAULT_STATE.koreaDocsDeliveryKrw,
          parkingFeeKrw:
            typeof item.parkingFeeKrw === "string" ? item.parkingFeeKrw : DEFAULT_STATE.parkingFeeKrw,
          brokerFeeRub:
            typeof item.brokerFeeRub === "string" ? item.brokerFeeRub : DEFAULT_STATE.brokerFeeRub,
          deliveryRoute: isDeliveryRoute(item.deliveryRoute)
            ? item.deliveryRoute
            : DEFAULT_STATE.deliveryRoute,
          deliveryRub:
            typeof item.deliveryRub === "string" ? item.deliveryRub : DEFAULT_STATE.deliveryRub,
          deliveryUsd:
            typeof item.deliveryUsd === "string" ? item.deliveryUsd : DEFAULT_STATE.deliveryUsd,
          escortRub: typeof item.escortRub === "string" ? item.escortRub : DEFAULT_STATE.escortRub,
          rates,
        } satisfies UserPreset;
      })
      .slice(0, MAX_USER_PRESETS);
  } catch {
    return [];
  }
}

function saveUserPresets(items: UserPreset[]) {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_USER_PRESETS)));
  } catch {
    // localStorage недоступен
  }
}

const IMPORTER_OPTIONS: Array<{ value: ImporterType; label: string }> = [
  { value: "personal", label: "Физ. лицо (для личного использования)" },
  { value: "resale", label: "Физ. лицо (для перепродажи)" },
  { value: "legal", label: "Юридическое лицо" },
];

const AGE_OPTIONS: Array<{ value: CarAge; label: string }> = [
  { value: "under3", label: "до 3х лет" },
  { value: "from3to5", label: "от 3х до 5 лет" },
  { value: "from5to7", label: "от 5 до 7 лет" },
  { value: "over7", label: "более 7 лет" },
];

const ENGINE_OPTIONS: Array<{ value: EngineType; label: string }> = [
  { value: "petrol", label: "Бензин / Дизель" },
  { value: "electric", label: "Электро и последовательный гибрид" },
];

const ORIGIN_OPTIONS: Array<{ value: OriginCountry; label: string }> = [
  { value: "china", label: "Китай" },
  { value: "korea", label: "Корея" },
];

const CURRENCY_OPTIONS: Array<{ value: CurrencyCode; label: string }> = [
  { value: "RUB", label: "Рубль" },
  { value: "USD", label: "Доллар США" },
  { value: "CNY", label: "Юань" },
  { value: "KRW", label: "Вона" },
];

const DELIVERY_ROUTE_OPTIONS: Array<{ value: DeliveryRoute; label: string }> = [
  { value: "ussuriysk", label: "Через Уссурийск" },
  { value: "kazakhstan", label: "Через Казахстан" },
];

function chinaExpensesForAge(age: CarAge): string {
  return age === "under3" ? "5000" : "12000";
}

function numberToInputString(value: number | undefined, fallback: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return String(value);
}

function inputToCalculatorState(input: CustomsCalculatorInput): CalculatorPersistedState {
  const originCountry = isOriginCountry(input.originCountry)
    ? input.originCountry
    : DEFAULT_STATE.originCountry;
  const engine = isEngine(input.engine) ? normalizeEngine(input.engine) : DEFAULT_STATE.engine;
  const age = isAge(input.age) ? input.age : DEFAULT_STATE.age;
  const deliveryRoute = isDeliveryRoute(input.deliveryRoute)
    ? input.deliveryRoute
    : originCountry === "korea"
      ? "vladivostok"
      : DEFAULT_STATE.deliveryRoute;

  return {
    originCountry,
    importer: isImporter(input.importer) ? input.importer : DEFAULT_STATE.importer,
    age,
    engine,
    powerHp: numberToInputString(input.powerHp, DEFAULT_STATE.powerHp),
    volumeCc: numberToInputString(input.volumeCc, DEFAULT_STATE.volumeCc),
    price: numberToInputString(input.price, DEFAULT_STATE.price),
    currency: isCurrency(input.currency) ? input.currency : DEFAULT_STATE.currency,
    chinaExpensesCny: numberToInputString(input.chinaExpensesCny, chinaExpensesForAge(age)),
    koreaDocsDeliveryKrw: numberToInputString(
      input.koreaDocsDeliveryKrw,
      DEFAULT_STATE.koreaDocsDeliveryKrw,
    ),
    parkingFeeKrw: numberToInputString(input.parkingFeeKrw, DEFAULT_STATE.parkingFeeKrw),
    brokerFeeRub: numberToInputString(
      input.brokerFeeRub,
      originCountry === "korea"
        ? String(DEFAULT_KOREA_BROKER_FEE_RUB)
        : DEFAULT_STATE.brokerFeeRub,
    ),
    deliveryRoute,
    deliveryRub: numberToInputString(
      input.deliveryRub,
      originCountry === "korea" ? String(DEFAULT_KOREA_DELIVERY_RUB) : DEFAULT_STATE.deliveryRub,
    ),
    deliveryUsd: numberToInputString(input.deliveryUsd, DEFAULT_STATE.deliveryUsd),
    escortRub: numberToInputString(input.escortRub, DEFAULT_STATE.escortRub),
    rates: roundExchangeRates({
      ...DEFAULT_EXCHANGE_RATES,
      ...(input.rates ?? {}),
    }),
    ratesUpdatedAt: null,
    submitted: true,
  };
}

function formatForeignNote(amount: number, code: "CNY" | "KRW"): string | undefined {
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return `${amount.toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
  }).replace(/[\u00A0\u202F]/g, " ")} ${code}`;
}

function formatTableCurrency(value: number): string {
  const amount = Math.round(value)
    .toLocaleString("ru-RU", { maximumFractionDigits: 0 })
    .replace(/[\u00A0\u202F]/g, " ");
  return `${amount} ₽`;
}

function priceToForeign(
  price: number,
  currency: CurrencyCode,
  priceRub: number,
  rates: ExchangeRates,
  code: "CNY" | "KRW",
): number {
  if (currency === code) return price;
  const rate = rates[code];
  if (!rate || rate <= 0) return 0;
  return priceRub / rate;
}

function ResultRow({
  label,
  value,
  note,
  emphasize,
  compact,
}: {
  label: string;
  value: number;
  note?: string;
  emphasize?: boolean;
  compact?: boolean;
}) {
  if (value === 0) return null;

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_7.75rem] items-center gap-x-3 border-b border-border/50 last:border-b-0",
        compact ? "py-1.5" : "py-3",
        emphasize && (compact ? "border-b-0 pt-2" : "border-b-0 pt-4"),
      )}
    >
      <div className="min-w-0 pr-1">
        <p
          className={cn(
            "leading-snug",
            compact ? "text-xs" : "text-sm",
            emphasize ? "font-semibold text-foreground" : "text-muted-foreground",
          )}
        >
          {label}
        </p>
        {note && (
          <p
            className={cn(
              "mt-0.5 leading-snug text-muted-foreground",
              compact ? "text-[10px]" : "text-xs",
            )}
          >
            {note}
          </p>
        )}
      </div>
      <p
        className={cn(
          "text-right font-medium leading-none tracking-normal tabular-nums whitespace-nowrap",
          emphasize
            ? compact
              ? "text-xs font-semibold"
              : "text-base font-semibold"
            : compact
              ? "text-xs"
              : "text-sm",
        )}
      >
        {formatTableCurrency(value)}
      </p>
    </div>
  );
}

function ResultSection({
  title,
  children,
  compact,
}: {
  title?: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border bg-muted/10", compact ? "px-2.5 py-0.5" : "rounded-xl px-4 py-1")}>
      {title && (
        <p
          className={cn(
            "border-b border-border/40 font-semibold uppercase tracking-wide text-muted-foreground",
            compact ? "pb-1 pt-1.5 text-[10px]" : "pb-2 pt-3 text-xs",
          )}
        >
          {title}
        </p>
      )}
      <div>{children}</div>
    </div>
  );
}

function FormSection({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-muted/10">
      <CollapsibleTrigger open={open} onToggle={onToggle} className="px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </CollapsibleTrigger>
      <CollapsiblePanel open={open}>
        <div className="space-y-4 px-4 pb-4">{children}</div>
      </CollapsiblePanel>
    </div>
  );
}

function FieldHint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function downloadBlob(filename: string, dataUrl: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

function exportFilename(extension: "pdf" | "jpg") {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `rastamozhka-${stamp}.${extension}`;
}

async function captureResultCanvas(element: HTMLElement, scale = 2) {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  const html2canvas = (await import("html2canvas")).default;
  return html2canvas(element, {
    scale,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: (_doc, cloned) => {
      cloned.style.backgroundColor = "#ffffff";
      cloned.style.color = "#1f2937";
      cloned.style.fontFamily = "Arial, Helvetica, sans-serif";
      cloned.style.letterSpacing = "0";
      cloned.style.wordSpacing = "0";
      cloned.querySelectorAll<HTMLElement>("*").forEach((node) => {
        node.style.letterSpacing = "0";
        node.style.wordSpacing = "normal";
        node.style.fontVariantNumeric = "tabular-nums";
        node.style.fontFamily = "Arial, Helvetica, sans-serif";
      });
    },
  });
}

async function saveResultAsJpeg(element: HTMLElement) {
  const canvas = await captureResultCanvas(element, 3);
  downloadBlob(exportFilename("jpg"), canvas.toDataURL("image/jpeg", 0.98));
}

async function saveResultAsPdf(element: HTMLElement) {
  const canvas = await captureResultCanvas(element, 2.5);
  const { jsPDF } = await import("jspdf");
  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  // Вписываем расчёт на одну страницу A4 без разбиения
  let imgWidth = usableWidth;
  let imgHeight = (canvas.height * imgWidth) / canvas.width;
  if (imgHeight > usableHeight) {
    const scale = usableHeight / imgHeight;
    imgWidth *= scale;
    imgHeight = usableHeight;
  }

  const x = margin + (usableWidth - imgWidth) / 2;
  const y = margin + (usableHeight - imgHeight) / 2;
  pdf.addImage(imgData, "JPEG", x, y, imgWidth, imgHeight);
  pdf.save(exportFilename("pdf"));
}

export function CustomsCalculator() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [originCountry, setOriginCountry] = useState<OriginCountry>(DEFAULT_STATE.originCountry);
  const [importer, setImporter] = useState<ImporterType>(DEFAULT_STATE.importer);
  const [age, setAge] = useState<CarAge>(DEFAULT_STATE.age);
  const [engine, setEngine] = useState<EngineType>(DEFAULT_STATE.engine);
  const [powerHp, setPowerHp] = useState(DEFAULT_STATE.powerHp);
  const [volumeCc, setVolumeCc] = useState(DEFAULT_STATE.volumeCc);
  const [price, setPrice] = useState(DEFAULT_STATE.price);
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_STATE.currency);
  const [chinaExpensesCny, setChinaExpensesCny] = useState(DEFAULT_STATE.chinaExpensesCny);
  const [koreaDocsDeliveryKrw, setKoreaDocsDeliveryKrw] = useState(
    DEFAULT_STATE.koreaDocsDeliveryKrw,
  );
  const [parkingFeeKrw, setParkingFeeKrw] = useState(DEFAULT_STATE.parkingFeeKrw);
  const [brokerFeeRub, setBrokerFeeRub] = useState(DEFAULT_STATE.brokerFeeRub);
  const [deliveryRoute, setDeliveryRoute] = useState<DeliveryRoute>(DEFAULT_STATE.deliveryRoute);
  const [deliveryRub, setDeliveryRub] = useState(DEFAULT_STATE.deliveryRub);
  const [deliveryUsd, setDeliveryUsd] = useState(DEFAULT_STATE.deliveryUsd);
  const [escortRub, setEscortRub] = useState(DEFAULT_STATE.escortRub);
  const [rates, setRates] = useState<ExchangeRates>(DEFAULT_STATE.rates);
  const [submitted, setSubmitted] = useState(DEFAULT_STATE.submitted);
  const [hydrated, setHydrated] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "jpeg" | null>(null);
  const [history, setHistory] = useState<CalculatorHistoryItem[]>([]);
  const [userPresets, setUserPresets] = useState<UserPreset[]>([]);
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [autoOpen, setAutoOpen] = useState(true);
  const [expensesOpen, setExpensesOpen] = useState(true);
  const [ratesOpen, setRatesOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [formulasOpen, setFormulasOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const resultSectionRef = useRef<HTMLDivElement>(null);
  const lastHistorySignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const stored = loadPersistedState();
    setOriginCountry(stored.originCountry);
    setImporter(stored.importer);
    setAge(stored.age);
    setEngine(stored.engine);
    setPowerHp(stored.powerHp);
    setVolumeCc(stored.volumeCc);
    setPrice(stored.price);
    setCurrency(stored.currency);
    setChinaExpensesCny(stored.chinaExpensesCny);
    setKoreaDocsDeliveryKrw(stored.koreaDocsDeliveryKrw);
    setParkingFeeKrw(stored.parkingFeeKrw);
    setBrokerFeeRub(stored.brokerFeeRub);
    setDeliveryRoute(stored.deliveryRoute);
    setDeliveryRub(stored.deliveryRub);
    setDeliveryUsd(stored.deliveryUsd);
    setEscortRub(stored.escortRub);
    setRates(stored.rates);
    setRatesUpdatedAt(stored.ratesUpdatedAt);
    setSubmitted(stored.submitted);
    setHistory(loadCalculatorHistory());
    setUserPresets(loadUserPresets());
    setHydrated(true);
  }, []);

  const loadExchangeRates = async () => {
    setRatesLoading(true);
    try {
      const data = await api.exchangeRates.get(true);
      setRates(roundExchangeRates(data.rates));
      setRatesUpdatedAt(data.fetchedAt);
      toast.success("Курсы обновлены");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось загрузить курсы";
      toast.error(message);
    } finally {
      setRatesLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    savePersistedState({
      originCountry,
      importer,
      age,
      engine,
      powerHp,
      volumeCc,
      price,
      currency,
      chinaExpensesCny,
      koreaDocsDeliveryKrw,
      parkingFeeKrw,
      brokerFeeRub,
      deliveryRoute,
      deliveryRub,
      deliveryUsd,
      escortRub,
      rates,
      ratesUpdatedAt,
      submitted,
    });
  }, [
    hydrated,
    originCountry,
    importer,
    age,
    engine,
    powerHp,
    volumeCc,
    price,
    currency,
    chinaExpensesCny,
    koreaDocsDeliveryKrw,
    parkingFeeKrw,
    brokerFeeRub,
    deliveryRoute,
    deliveryRub,
    deliveryUsd,
    escortRub,
    rates,
    ratesUpdatedAt,
    submitted,
  ]);

  const result = useMemo(() => {
    if (!submitted) return null;
    return calculateCustoms({
      originCountry,
      importer,
      age,
      engine,
      powerHp: Number(powerHp.replace(",", ".")),
      volumeCc: Number(volumeCc.replace(",", ".")),
      price: Number(price.replace(",", ".")),
      currency,
      rates,
      chinaExpensesCny: Number(chinaExpensesCny.replace(",", ".")),
      koreaDocsDeliveryKrw: Number(koreaDocsDeliveryKrw.replace(",", ".")),
      parkingFeeKrw: Number(parkingFeeKrw.replace(",", ".")),
      brokerFeeRub: Number(brokerFeeRub.replace(",", ".")),
      deliveryRoute,
      deliveryRub: Number(deliveryRub.replace(",", ".")),
      deliveryUsd: Number(deliveryUsd.replace(",", ".")),
      escortRub: Number(escortRub.replace(",", ".")),
    });
  }, [
    submitted,
    originCountry,
    importer,
    age,
    engine,
    powerHp,
    volumeCc,
    price,
    currency,
    rates,
    chinaExpensesCny,
    koreaDocsDeliveryKrw,
    parkingFeeKrw,
    brokerFeeRub,
    deliveryRoute,
    deliveryRub,
    deliveryUsd,
    escortRub,
  ]);

  useEffect(() => {
    if (!hydrated || !submitted || !result) return;

    const signature = JSON.stringify({
      originCountry,
      importer,
      age,
      engine,
      powerHp,
      volumeCc,
      price,
      currency,
      chinaExpensesCny,
      koreaDocsDeliveryKrw,
      parkingFeeKrw,
      brokerFeeRub,
      deliveryRoute,
      deliveryRub,
      deliveryUsd,
      escortRub,
      totalWithCar: result.totalWithCar,
    });

    if (lastHistorySignatureRef.current === signature) return;
    lastHistorySignatureRef.current = signature;

    const item: CalculatorHistoryItem = {
      id: `${Date.now()}`,
      savedAt: new Date().toISOString(),
      totalWithCar: result.totalWithCar,
      originCountry,
      importer,
      age,
      engine,
      powerHp,
      volumeCc,
      price,
      currency,
      chinaExpensesCny,
      koreaDocsDeliveryKrw,
      parkingFeeKrw,
      brokerFeeRub,
      deliveryRoute,
      deliveryRub,
      deliveryUsd,
      escortRub,
      rates,
      ratesUpdatedAt,
      submitted: true,
    };

    setHistory((current) => {
      const next = [item, ...current.filter((entry) => entry.id !== item.id)].slice(0, 8);
      saveCalculatorHistory(next);
      return next;
    });
  }, [
    hydrated,
    submitted,
    result,
    originCountry,
    importer,
    age,
    engine,
    powerHp,
    volumeCc,
    price,
    currency,
    chinaExpensesCny,
    koreaDocsDeliveryKrw,
    parkingFeeKrw,
    brokerFeeRub,
    deliveryRoute,
    deliveryRub,
    deliveryUsd,
    escortRub,
    rates,
    ratesUpdatedAt,
  ]);

  const handleCalculate = () => {
    setSubmitted(true);

    const isStackedLayout =
      typeof window !== "undefined" && window.matchMedia("(max-width: 1279px)").matches;
    if (!isStackedLayout) return;

    // Ждём отрисовку результата, затем скроллим к блоку расчёта
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };

  const handleExport = async (format: "pdf" | "jpeg") => {
    const element = exportRef.current;
    if (!element) return;

    const wasDetailsOpen = detailsOpen;
    if (!wasDetailsOpen) {
      setDetailsOpen(true);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      // Даём layout и шрифтам стабилизироваться перед снимком
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    setExporting(format);
    try {
      if (format === "pdf") {
        await saveResultAsPdf(element);
        toast.success("PDF сохранён");
      } else {
        await saveResultAsJpeg(element);
        toast.success("JPEG сохранён");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить файл");
    } finally {
      setExporting(null);
      // Не закрываем сразу — иначе на экране «скачут» шрифты/высота блока
      if (!wasDetailsOpen) {
        window.setTimeout(() => setDetailsOpen(false), 200);
      }
    }
  };

  const handleAgeChange = (next: CarAge) => {
    setAge(next);
    if (originCountry === "china") {
      setChinaExpensesCny(chinaExpensesForAge(next));
    }
  };

  const handleOriginChange = (next: OriginCountry) => {
    setOriginCountry(next);
    if (next === "korea") {
      setCurrency("KRW");
      setBrokerFeeRub(String(DEFAULT_KOREA_BROKER_FEE_RUB));
      setDeliveryRoute("vladivostok");
      setDeliveryRub(String(DEFAULT_KOREA_DELIVERY_RUB));
      setParkingFeeKrw(String(DEFAULT_KOREA_PARKING_FEE_KRW));
      setKoreaDocsDeliveryKrw(String(DEFAULT_KOREA_DOCS_DELIVERY_KRW));
    } else {
      setCurrency("CNY");
      setBrokerFeeRub(String(DEFAULT_BROKER_FEE_RUB));
      setDeliveryRoute("ussuriysk");
      setDeliveryRub(String(DEFAULT_DELIVERY_RUB));
      setChinaExpensesCny(chinaExpensesForAge(age));
    }
  };

  const applyScenario = (scenario: Partial<CalculatorPersistedState>) => {
    if (scenario.originCountry) setOriginCountry(scenario.originCountry);
    if (scenario.importer) setImporter(scenario.importer);
    if (scenario.age) setAge(scenario.age);
    if (scenario.engine) setEngine(scenario.engine);
    if (scenario.powerHp !== undefined) setPowerHp(scenario.powerHp);
    if (scenario.volumeCc !== undefined) setVolumeCc(scenario.volumeCc);
    if (scenario.price !== undefined) setPrice(scenario.price);
    if (scenario.currency) setCurrency(scenario.currency);
    if (scenario.chinaExpensesCny !== undefined) setChinaExpensesCny(scenario.chinaExpensesCny);
    if (scenario.koreaDocsDeliveryKrw !== undefined) {
      setKoreaDocsDeliveryKrw(scenario.koreaDocsDeliveryKrw);
    }
    if (scenario.parkingFeeKrw !== undefined) setParkingFeeKrw(scenario.parkingFeeKrw);
    if (scenario.brokerFeeRub !== undefined) setBrokerFeeRub(scenario.brokerFeeRub);
    if (scenario.deliveryRoute) setDeliveryRoute(scenario.deliveryRoute);
    if (scenario.deliveryRub !== undefined) setDeliveryRub(scenario.deliveryRub);
    if (scenario.deliveryUsd !== undefined) setDeliveryUsd(scenario.deliveryUsd);
    if (scenario.escortRub !== undefined) setEscortRub(scenario.escortRub);
  };

  const applyHistoryItem = (item: CalculatorHistoryItem) => {
    applyScenario(item);
    setRates(item.rates);
    setRatesUpdatedAt(item.ratesUpdatedAt);
    setSubmitted(true);
    toast.success("Расчёт применён из истории");
  };

  const applyUserPreset = (preset: UserPreset) => {
    applyScenario(preset);
    setRates(preset.rates);
    toast.success(`Пресет «${preset.name}» применён`);
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) {
      toast.error("Введите название пресета");
      return;
    }

    const preset: UserPreset = {
      id: `${Date.now()}`,
      name: name.slice(0, 60),
      savedAt: new Date().toISOString(),
      originCountry,
      importer,
      age,
      engine,
      powerHp,
      volumeCc,
      price,
      currency,
      chinaExpensesCny,
      koreaDocsDeliveryKrw,
      parkingFeeKrw,
      brokerFeeRub,
      deliveryRoute,
      deliveryRub,
      deliveryUsd,
      escortRub,
      rates,
    };

    setUserPresets((current) => {
      const next = [preset, ...current.filter((item) => item.name !== preset.name)].slice(
        0,
        MAX_USER_PRESETS,
      );
      saveUserPresets(next);
      return next;
    });
    setPresetDialogOpen(false);
    setPresetName("");
    toast.success("Пресет сохранён");
  };

  const handleDeletePreset = (presetId: string) => {
    setUserPresets((current) => {
      const next = current.filter((item) => item.id !== presetId);
      saveUserPresets(next);
      return next;
    });
    toast.success("Пресет удалён");
  };

  const handleClearPresets = () => {
    setUserPresets([]);
    saveUserPresets([]);
    toast.success("Все пресеты удалены");
  };

  const handleDeleteHistoryItem = (historyId: string) => {
    setHistory((current) => {
      const next = current.filter((item) => item.id !== historyId);
      saveCalculatorHistory(next);
      return next;
    });
    toast.success("Расчёт удалён из истории");
  };

  const handleClearHistory = () => {
    setHistory([]);
    saveCalculatorHistory([]);
    lastHistorySignatureRef.current = null;
    toast.success("История расчётов очищена");
  };

  const dealIdFromQuery = searchParams.get("dealId");
  const estimateIdFromQuery = searchParams.get("estimateId");

  useEffect(() => {
    if (!hydrated || !dealIdFromQuery || !estimateIdFromQuery) return;

    let cancelled = false;

    void api.deals.customsEstimates
      .list(dealIdFromQuery)
      .then((estimates) => {
        if (cancelled) return;
        const estimate = estimates.find((item) => item.id === estimateIdFromQuery);
        if (!estimate) {
          toast.error("Расчёт из сделки не найден");
          router.replace("/calculator");
          return;
        }

        const state = inputToCalculatorState(estimate.input);
        applyScenario(state);
        setRates(state.rates);
        setRatesUpdatedAt(state.ratesUpdatedAt);
        setSubmitted(true);
        setDetailsOpen(true);
        setFormulasOpen(true);
        toast.success("Параметры загружены из сделки");
        router.replace("/calculator");
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Не удалось загрузить расчёт из сделки");
          router.replace("/calculator");
        }
      });

    return () => {
      cancelled = true;
    };
    // applyScenario is a one-shot apply helper; omit from deps intentionally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, dealIdFromQuery, estimateIdFromQuery, router]);

  const updateRate = (key: keyof ExchangeRates, value: string) => {
    const next = Number(value.replace(",", "."));
    if (!Number.isFinite(next) || next <= 0) return;
    setRates((current) => ({ ...current, [key]: roundExchangeRate(next) }));
  };

  const powerHpNumber = Number(powerHp.replace(",", "."));
  const volumeCcNumber = Number(volumeCc.replace(",", "."));
  const isElectric = normalizeEngine(engine) === "electric";
  const isKorea = originCountry === "korea";
  const showsCommercialRecyclingHint =
    importer === "personal" &&
    Number.isFinite(powerHpNumber) &&
    ((isElectric && powerHpNumber > PREFERENTIAL_MAX_HP_EV) ||
      (!isElectric &&
        (powerHpNumber > PREFERENTIAL_MAX_HP_ICE ||
          (Number.isFinite(volumeCcNumber) && volumeCcNumber > PREFERENTIAL_MAX_VOLUME_CC))));

  const chinaHint =
    age === "under3"
      ? "По умолчанию 5 000 CNY для авто до 3 лет"
      : "По умолчанию 12 000 CNY для авто от 3 лет";

  const kazakhstanDeliveryRub =
    Math.round(Number(deliveryUsd.replace(",", ".")) * rates.USD * 100) / 100;

  const calculatorInput = {
    originCountry,
    importer,
    age,
    engine,
    powerHp: Number(powerHp.replace(",", ".")),
    volumeCc: Number(volumeCc.replace(",", ".")),
    price: Number(price.replace(",", ".")),
    currency,
    rates,
    chinaExpensesCny: Number(chinaExpensesCny.replace(",", ".")),
    koreaDocsDeliveryKrw: Number(koreaDocsDeliveryKrw.replace(",", ".")),
    parkingFeeKrw: Number(parkingFeeKrw.replace(",", ".")),
    brokerFeeRub: Number(brokerFeeRub.replace(",", ".")),
    deliveryRoute,
    deliveryRub: Number(deliveryRub.replace(",", ".")),
    deliveryUsd: Number(deliveryUsd.replace(",", ".")),
    escortRub: Number(escortRub.replace(",", ".")),
  };

  return (
    <div
      className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]"
    >
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-muted text-brand">
              <CalculatorIcon className="h-4 w-4" />
            </span>
            Калькулятор растаможки
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Расчёт по ставкам 2026 года: таможенный сбор, пошлина, акциз, НДС и утильсбор.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Пресеты</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPresetName("");
                  setPresetDialogOpen(true);
                }}
              >
                Сохранить пресет
              </Button>
            </div>
            {userPresets.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">Мои пресеты</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                    onClick={handleClearPresets}
                  >
                    Очистить все
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {userPresets.map((preset) => (
                    <div key={preset.id} className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="rounded-r-none"
                        onClick={() => applyUserPreset(preset)}
                      >
                        {preset.name}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="rounded-l-none px-2 text-muted-foreground hover:text-destructive"
                        aria-label={`Удалить пресет ${preset.name}`}
                        onClick={() => handleDeletePreset(preset.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Сохраните текущие параметры расчёта, чтобы быстро подставлять их позже.
              </p>
            )}
          </div>

          <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Сохранить пресет</DialogTitle>
                <DialogDescription>
                  Сохранятся текущие параметры расчёта. Пресет останется на этом устройстве.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="preset-name">Название</Label>
                  <Input
                    id="preset-name"
                    value={presetName}
                    onChange={(event) => setPresetName(event.target.value.slice(0, 60))}
                    placeholder="Например: Changan Q05 льготный"
                    maxLength={60}
                    autoFocus
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleSavePreset();
                      }
                    }}
                  />
                </div>
                <Button type="button" variant="brand" className="w-full" onClick={handleSavePreset}>
                  Сохранить
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <FormSection
            title="1. Автомобиль"
            subtitle="Страна, кто ввозит, возраст, двигатель, цена и мощность"
            open={autoOpen}
            onToggle={() => setAutoOpen((value) => !value)}
          >
            <div className="space-y-2">
              <Label>Страна экспорта авто</Label>
              <Select
                value={originCountry}
                onValueChange={(value) => handleOriginChange(value as OriginCountry)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORIGIN_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Автомобиль ввозит</Label>
              <Select value={importer} onValueChange={(value) => setImporter(value as ImporterType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPORTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Возраст автомобиля</Label>
                <Select value={age} onValueChange={(value) => handleAgeChange(value as CarAge)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Тип двигателя</Label>
                <Select
                  value={normalizeEngine(engine)}
                  onValueChange={(value) => setEngine(value as EngineType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENGINE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <div className="space-y-2">
                <Label htmlFor="car-price">Стоимость автомобиля</Label>
                <Input
                  id="car-price"
                  type="number"
                  min={1}
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Валюта</Label>
                {isKorea ? (
                  <>
                    <Input value="KRW — вона" readOnly disabled />
                    <FieldHint>Для Кореи расчёт в корейских вонах</FieldHint>
                  </>
                ) : (
                  <Select value={currency} onValueChange={(value) => setCurrency(value as CurrencyCode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="power-hp">
                  {isElectric ? "30-ти минутная мощность" : "Мощность, л.с."}
                </Label>
                <Input
                  id="power-hp"
                  type="number"
                  min={1}
                  step="1"
                  value={powerHp}
                  onChange={(event) => setPowerHp(event.target.value)}
                />
                {showsCommercialRecyclingHint && (
                  <FieldHint>Будет коммерческий утильсбор (сверх льготного порога)</FieldHint>
                )}
                {importer === "personal" &&
                  !showsCommercialRecyclingHint &&
                  Number.isFinite(powerHpNumber) &&
                  powerHpNumber > 0 && (
                    <FieldHint>
                      {isElectric
                        ? `Льготный УС до ${PREFERENTIAL_MAX_HP_EV} л.с.`
                        : `Льготный УС до ${PREFERENTIAL_MAX_HP_ICE} л.с. и ${PREFERENTIAL_MAX_VOLUME_CC.toLocaleString("ru-RU")} см³`}
                    </FieldHint>
                  )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="volume-cc">Объём двигателя, см³</Label>
                <Input
                  id="volume-cc"
                  type="number"
                  min={1}
                  step="1"
                  value={volumeCc}
                  onChange={(event) => setVolumeCc(event.target.value)}
                  disabled={isElectric}
                  placeholder={isElectric ? "Не требуется" : undefined}
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            title="2. Расходы"
            subtitle={
              isKorea
                ? "Стоянка, документы, брокер, доставка и сопровождение"
                : "Китай, брокер, доставка и сопровождение"
            }
            open={expensesOpen}
            onToggle={() => setExpensesOpen((value) => !value)}
          >
            {isKorea ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="parking-fee">Комиссия стоянки, воны (KRW)</Label>
                  <Input
                    id="parking-fee"
                    type="number"
                    min={0}
                    step="1"
                    value={parkingFeeKrw}
                    onChange={(event) => setParkingFeeKrw(event.target.value)}
                  />
                  <FieldHint>
                    По умолчанию {DEFAULT_KOREA_PARKING_FEE_KRW.toLocaleString("ru-RU")} KRW
                  </FieldHint>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="korea-docs">Документы и доставка до РФ, воны (KRW)</Label>
                  <Input
                    id="korea-docs"
                    type="number"
                    min={0}
                    step="1"
                    value={koreaDocsDeliveryKrw}
                    onChange={(event) => setKoreaDocsDeliveryKrw(event.target.value)}
                  />
                  <FieldHint>
                    По умолчанию {DEFAULT_KOREA_DOCS_DELIVERY_KRW.toLocaleString("ru-RU")} KRW
                  </FieldHint>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="china-expenses">Расходы по Китаю, юани (CNY)</Label>
                <Input
                  id="china-expenses"
                  type="number"
                  min={0}
                  step="0.01"
                  value={chinaExpensesCny}
                  onChange={(event) => setChinaExpensesCny(event.target.value)}
                />
                <FieldHint>{chinaHint}</FieldHint>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="broker-fee">Услуги брокера, ₽</Label>
              <Input
                id="broker-fee"
                type="number"
                min={0}
                step="1"
                value={brokerFeeRub}
                onChange={(event) => setBrokerFeeRub(event.target.value)}
              />
              {isKorea && (
                <FieldHint>
                  По умолчанию {DEFAULT_KOREA_BROKER_FEE_RUB.toLocaleString("ru-RU")} ₽ для Кореи
                </FieldHint>
              )}
            </div>

            {isKorea ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="delivery-rub">Доставка из Владивостока, ₽</Label>
                  <Input
                    id="delivery-rub"
                    type="number"
                    min={0}
                    step="1"
                    value={deliveryRub}
                    onChange={(event) => setDeliveryRub(event.target.value)}
                  />
                  <FieldHint>
                    По умолчанию {DEFAULT_KOREA_DELIVERY_RUB.toLocaleString("ru-RU")} ₽
                  </FieldHint>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="escort-rub">Услуги сопровождения, ₽</Label>
                  <Input
                    id="escort-rub"
                    type="number"
                    min={0}
                    step="1"
                    value={escortRub}
                    onChange={(event) => setEscortRub(event.target.value)}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Доставка</Label>
                  <Select
                    value={deliveryRoute}
                    onValueChange={(value) => {
                      const next = value as DeliveryRoute;
                      setDeliveryRoute(next);
                      if (next === "kazakhstan" && !deliveryUsd.trim()) {
                        setDeliveryUsd(String(KAZAKHSTAN_DELIVERY_USD));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Маршрут доставки" />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERY_ROUTE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    {deliveryRoute === "kazakhstan" ? (
                      <>
                        <Label htmlFor="delivery-usd">Стоимость доставки, USD</Label>
                        <Input
                          id="delivery-usd"
                          type="number"
                          min={0}
                          step="0.01"
                          value={deliveryUsd}
                          onChange={(event) => setDeliveryUsd(event.target.value)}
                        />
                        <FieldHint>
                          По умолчанию {KAZAKHSTAN_DELIVERY_USD.toLocaleString("ru-RU")} USD
                          {Number.isFinite(kazakhstanDeliveryRub)
                            ? ` ≈ ${kazakhstanDeliveryRub.toLocaleString("ru-RU", {
                                maximumFractionDigits: 0,
                              })} ₽`
                            : ""}
                        </FieldHint>
                      </>
                    ) : (
                      <>
                        <Label htmlFor="delivery-rub">Стоимость доставки, ₽</Label>
                        <Input
                          id="delivery-rub"
                          type="number"
                          min={0}
                          step="1"
                          value={deliveryRub}
                          onChange={(event) => setDeliveryRub(event.target.value)}
                        />
                      </>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="escort-rub">Услуги сопровождения, ₽</Label>
                    <Input
                      id="escort-rub"
                      type="number"
                      min={0}
                      step="1"
                      value={escortRub}
                      onChange={(event) => setEscortRub(event.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
          </FormSection>

          <FormSection
            title="3. Курсы валют"
            subtitle={
              ratesLoading
                ? "Загрузка…"
                : ratesUpdatedAt
                  ? `Обновлено ${new Date(ratesUpdatedAt).toLocaleString("ru-RU")}`
                  : "Обновите курсы вручную"
            }
            open={ratesOpen}
            onToggle={() => setRatesOpen((value) => !value)}
          >
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={ratesLoading}
                onClick={() => void loadExchangeRates()}
              >
                {ratesLoading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Обновить курсы
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(DEFAULT_EXCHANGE_RATES) as Array<keyof ExchangeRates>).map((code) => (
                <div key={code} className="space-y-1.5">
                  <Label htmlFor={`rate-${code}`} className="text-xs text-muted-foreground">
                    {code}
                  </Label>
                  <Input
                    id={`rate-${code}`}
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={rates[code]}
                    onChange={(event) => updateRate(code, event.target.value)}
                  />
                </div>
              ))}
            </div>
          </FormSection>

          <Button type="button" variant="brand" className="w-full" onClick={handleCalculate}>
            Рассчитать
          </Button>
        </CardContent>
      </Card>

      <Card ref={resultSectionRef} className="scroll-mt-20 border-0 shadow-card xl:sticky xl:top-20 xl:self-start">
        <CardHeader>
          <CardTitle>Результат расчёта</CardTitle>
          <p className="text-sm text-muted-foreground">
            {isKorea
              ? "Все суммы в рублях. Первый платёж по инвойсу = авто + стоянка + документы/доставка до РФ."
              : "Все суммы в рублях. Итог с комиссией ВТБ = (авто + расходы по Китаю) + 2%."}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="brand">{isKorea ? "Корея" : "Китай"}</Badge>
            <Badge variant="outline">
              Курс {isKorea ? "KRW" : "CNY"}:{" "}
              {(isKorea ? rates.KRW : rates.CNY).toLocaleString("ru-RU", {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2,
              })}{" "}
              ₽
            </Badge>
            {ratesUpdatedAt && (
              <Badge variant="outline">
                Курс обновлён {new Date(ratesUpdatedAt).toLocaleString("ru-RU")}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!submitted && (
            <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
              Заполните параметры и нажмите «Рассчитать»
            </div>
          )}

          {submitted && !result && (
            <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50/50 px-6 py-12 text-center text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              Проверьте мощность, объём двигателя и стоимость автомобиля
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {result.totalWithCar !== 0 && (
                <div className="rounded-xl border border-brand/20 bg-brand-muted/40 px-4 py-4">
                  <p className="text-sm text-muted-foreground">Итого со всеми расходами</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
                    {formatCurrency(result.totalWithCar)}
                  </p>
                </div>
              )}

              <div className="rounded-xl border">
                <CollapsibleTrigger
                  open={formulasOpen}
                  onToggle={() => setFormulasOpen((value) => !value)}
                  className="px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Пояснения к формулам</p>
                    <p className="text-xs text-muted-foreground">
                      Утильсбор, пошлина и НДС в этом расчёте
                    </p>
                  </div>
                </CollapsibleTrigger>
                <CollapsiblePanel open={formulasOpen}>
                  <div className="space-y-3 px-4 pb-4 text-sm">
                    <div className="rounded-lg border bg-muted/10 px-3 py-3">
                      <p className="font-medium">Утилизационный сбор (УС)</p>
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                        <li>
                          База для легковых:{" "}
                          {RECYCLING_BASE_PASSENGER.toLocaleString("ru-RU")} ₽
                        </li>
                        <li>
                          Льготный для физлица (личное пользование): ДВС до{" "}
                          {PREFERENTIAL_MAX_HP_ICE} л.с. и{" "}
                          {PREFERENTIAL_MAX_VOLUME_CC.toLocaleString("ru-RU")} см³ либо электро до{" "}
                          {PREFERENTIAL_MAX_HP_EV} л.с. — коэффициент 0,17 (до 3 лет) или 0,26
                        </li>
                        <li>
                          Иначе коммерческий коэффициент по мощности / объёму двигателя
                        </li>
                      </ul>
                      <p className="mt-2 text-xs">
                        В этом расчёте: {result.recyclingNote} ={" "}
                        <span className="font-medium tabular-nums">
                          {formatCurrency(result.recyclingFee)}
                        </span>
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/10 px-3 py-3">
                      <p className="font-medium">Таможенная пошлина (ТП)</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Зависит от возраста, типа двигателя, стоимости и объёма. Ставка в расчёте:{" "}
                        {result.customsDutyNote || "см. подробный расчёт"}.
                      </p>
                      <p className="mt-2 text-xs">
                        Сумма:{" "}
                        <span className="font-medium tabular-nums">
                          {formatCurrency(result.customsDuty)}
                        </span>
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/10 px-3 py-3">
                      <p className="font-medium">НДС</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        20% от (стоимость авто + таможенная пошлина + акциз).
                      </p>
                      <p className="mt-2 text-xs">
                        Сумма:{" "}
                        <span className="font-medium tabular-nums">
                          {formatCurrency(result.vat)}
                        </span>
                      </p>
                    </div>
                  </div>
                </CollapsiblePanel>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={exporting !== null}
                  onClick={() => void handleExport("pdf")}
                >
                  {exporting === "pdf" ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="mr-1.5 h-4 w-4" />
                  )}
                  PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={exporting !== null}
                  onClick={() => void handleExport("jpeg")}
                >
                  {exporting === "jpeg" ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <ImageDown className="mr-1.5 h-4 w-4" />
                  )}
                  JPEG
                </Button>
              </div>

              <SaveEstimateToDealButton
                input={calculatorInput}
                totalWithCar={result.totalWithCar}
                disabled={exporting !== null}
              />

              <div className="rounded-xl border">
                <CollapsibleTrigger
                  open={detailsOpen}
                  onToggle={() => setDetailsOpen((value) => !value)}
                  className="px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Подробный расчёт</p>
                    <p className="text-xs text-muted-foreground">
                      {isKorea ? "Инвойс, таможня, доставка" : "ВТБ, таможня, доставка"}
                    </p>
                  </div>
                </CollapsibleTrigger>
                <CollapsiblePanel open={detailsOpen}>
                  <div ref={exportRef} className="space-y-2 bg-background px-3 pb-3">
                    <div className="border-b border-border/40 pb-1.5">
                      <p className="text-sm font-semibold">
                        Расчёт растаможки · {isKorea ? "Корея" : "Китай"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Курс {isKorea ? "KRW" : "CNY"}:{" "}
                        {(isKorea ? rates.KRW : rates.CNY).toLocaleString("ru-RU", {
                          maximumFractionDigits: 2,
                          minimumFractionDigits: 2,
                        })}{" "}
                        ₽
                      </p>
                    </div>

                    <ResultSection compact>
                      <ResultRow
                        compact
                        label="Стоимость авто в рублях"
                        value={result.priceRub}
                        note={formatForeignNote(
                          priceToForeign(
                            calculatorInput.price,
                            currency,
                            result.priceRub,
                            rates,
                            isKorea ? "KRW" : "CNY",
                          ),
                          isKorea ? "KRW" : "CNY",
                        )}
                      />
                      {isKorea ? (
                        <>
                          <ResultRow
                            compact
                            label="Комиссия стоянки"
                            value={result.parkingFeeRub}
                            note={formatForeignNote(result.parkingFeeKrw, "KRW")}
                          />
                          <ResultRow
                            compact
                            label="Документы и доставка до РФ"
                            value={result.koreaDocsDeliveryRub}
                            note={formatForeignNote(result.koreaDocsDeliveryKrw, "KRW")}
                          />
                          <ResultRow
                            compact
                            label={result.firstPaymentLabel}
                            value={result.vtbTotalRub}
                            note={result.firstPaymentNote}
                            emphasize
                          />
                        </>
                      ) : (
                        <>
                          <ResultRow
                            compact
                            label="Расходы по Китаю"
                            value={result.chinaExpensesRub}
                            note={formatForeignNote(result.chinaExpensesCny, "CNY")}
                          />
                          <ResultRow
                            compact
                            label={result.firstPaymentLabel}
                            value={result.vtbTotalRub}
                            note={result.firstPaymentNote}
                            emphasize
                          />
                        </>
                      )}
                    </ResultSection>

                    <ResultSection compact title="Расходы по России">
                      <ResultRow compact label="Услуги брокера" value={result.brokerFeeRub} />
                      <ResultRow compact label="Таможенный сбор (ТС)" value={result.customsFee} />
                      <ResultRow
                        compact
                        label="Таможенная пошлина (ТП)"
                        value={result.customsDuty}
                        note={result.customsDutyNote}
                      />
                      <ResultRow
                        compact
                        label="Утилизационный сбор (УС)"
                        value={result.recyclingFee}
                        note={result.recyclingNote}
                      />
                      <ResultRow compact label="Акциз (А)" value={result.excise} />
                      <ResultRow
                        compact
                        label="НДС"
                        value={result.vat}
                        note="20% от (стоимость + пошлина + акциз)"
                      />
                    </ResultSection>

                    <ResultSection compact title="Доставка">
                      <ResultRow
                        compact
                        label="Доставка"
                        value={result.deliveryRub}
                        note={result.deliveryNote}
                      />
                      <ResultRow compact label="Услуги сопровождения" value={result.escortRub} />
                    </ResultSection>

                    {result.totalWithCar !== 0 && (
                      <div className="rounded-lg border border-brand/20 bg-brand-muted/40 px-3 py-2.5">
                        <p className="text-[11px] text-muted-foreground">Итого со всеми расходами</p>
                        <p className="mt-0.5 text-xl font-semibold tracking-normal tabular-nums">
                          {formatTableCurrency(result.totalWithCar)}
                        </p>
                      </div>
                    )}
                  </div>
                </CollapsiblePanel>
              </div>

              {history.length > 0 && (
                <div className="rounded-xl border">
                  <CollapsibleTrigger
                    open={historyOpen}
                    onToggle={() => setHistoryOpen((value) => !value)}
                    className="px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">История расчётов</p>
                        <Badge variant="outline">{history.length}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Последние расчёты на этом устройстве
                      </p>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsiblePanel open={historyOpen}>
                    <div className="space-y-2 px-4 pb-4">
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                          onClick={handleClearHistory}
                        >
                          Очистить
                        </Button>
                      </div>
                      {history.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-1 rounded-lg border pr-1"
                        >
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                            onClick={() => applyHistoryItem(item)}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                {item.originCountry === "korea" ? "Корея" : "Китай"} ·{" "}
                                {item.engine === "electric" ? "электро" : "ДВС"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(item.savedAt).toLocaleString("ru-RU")}
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-semibold tabular-nums">
                              {formatCurrency(item.totalWithCar)}
                            </p>
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            aria-label="Удалить из истории"
                            onClick={() => handleDeleteHistoryItem(item.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CollapsiblePanel>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {result && result.totalWithCar !== 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 p-3 backdrop-blur xl:hidden">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Итого</p>
              <p className="truncate text-lg font-semibold tabular-nums">
                {formatCurrency(result.totalWithCar)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              К расчёту
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
