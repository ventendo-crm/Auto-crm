"use client";

import { Calculator as CalculatorIcon, FileDown, ImageDown, Loader2, Pencil, RefreshCw, Share2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CalculatorExpenseEditor } from "@/components/calculator/calculator-expense-editor";
import { CalculatorPresetsPanel } from "@/components/calculator/calculator-presets-panel";
import { SaveEstimateToDealButton } from "@/components/calculator/save-estimate-to-deal-button";
import { MOBILE_TAB_BAR_OFFSET_CLASS } from "@/components/layout/staff-nav";
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
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-is-mobile";
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
  DEFAULT_KYRGYZSTAN_CITY_DELIVERY_USD,
  DeliveryRoute,
  EngineType,
  ExchangeRates,
  findExpenseByRole,
  getDefaultCompanyCalculatorExpenses,
  ImporterType,
  isChinaLikeOrigin,
  isCustomOriginId,
  isKyrgyzstanOrigin,
  KAZAKHSTAN_DELIVERY_USD,
  listExtraExpenses,
  OriginCountry,
  PREFERENTIAL_MAX_HP_EV,
  PREFERENTIAL_MAX_HP_ICE,
  PREFERENTIAL_MAX_VOLUME_CC,
  exchangeRateDecimals,
  roundExchangeRate,
  roundExchangeRates,
  buildOriginOptions,
  defaultInputCurrencyForOrigin,
  type CalculatorExpenseItem,
  type CustomCalculatorOrigin,
} from "@/lib/customs-calculator";
import type { CalculatorPresetInput } from "@/lib/validators/calculator-settings";
import { canManageCompanyCalculator, getClientRoleName } from "@/lib/permissions";
import { cn, formatCurrency } from "@/lib/utils";

const STORAGE_KEY = "autocrm-customs-calculator";
const HISTORY_STORAGE_KEY = "autocrm-customs-calculator-history";
const PRESETS_STORAGE_KEY = "autocrm-customs-calculator-presets";
const MAX_USER_PRESETS = 20;
const EXPORT_LOGO_SRC = "/api/calculator/settings/logo";

type CalculatorPersistedState = {
  originCountry: OriginCountry;
  importer: ImporterType;
  age: CarAge;
  engine: EngineType;
  powerHp: string;
  volumeCc: string;
  price: string;
  /** Стоимость для таможни (каталог), только для new; пусто = не используется */
  customsPrice: string;
  currency: CurrencyCode;
  chinaExpensesCny: string;
  cityDeliveryUsd: string;
  koreaDocsDeliveryKrw: string;
  parkingFeeKrw: string;
  brokerFeeRub: string;
  deliveryRoute: DeliveryRoute;
  deliveryRub: string;
  deliveryUsd: string;
  escortRub: string;
  /** Киргизия: автомобиль растаможен (пошлина не считается) */
  kyrgyzstanCustomsCleared: boolean;
  rates: ExchangeRates;
  ratesUpdatedAt: string | null;
  submitted: boolean;
};

type CalculatorHistoryItem = CalculatorPersistedState & {
  id: string;
  savedAt: string;
  totalWithCar: number;
};

type UserPreset = CalculatorPresetInput;

const DEFAULT_STATE: CalculatorPersistedState = {
  originCountry: "china",
  importer: "personal",
  age: "under3",
  engine: "petrol",
  powerHp: "150",
  volumeCc: "2000",
  price: "25000",
  customsPrice: "",
  currency: "CNY",
  chinaExpensesCny: "12000",
  cityDeliveryUsd: String(DEFAULT_KYRGYZSTAN_CITY_DELIVERY_USD),
  koreaDocsDeliveryKrw: String(DEFAULT_KOREA_DOCS_DELIVERY_KRW),
  parkingFeeKrw: String(DEFAULT_KOREA_PARKING_FEE_KRW),
  brokerFeeRub: String(DEFAULT_BROKER_FEE_RUB),
  deliveryRoute: "ussuriysk",
  deliveryRub: String(DEFAULT_DELIVERY_RUB),
  deliveryUsd: String(KAZAKHSTAN_DELIVERY_USD),
  escortRub: String(DEFAULT_ESCORT_RUB),
  kyrgyzstanCustomsCleared: true,
  rates: DEFAULT_EXCHANGE_RATES,
  ratesUpdatedAt: null,
  submitted: false,
};

function isImporter(value: unknown): value is ImporterType {
  return value === "personal" || value === "resale" || value === "legal";
}

function isAge(value: unknown): value is CarAge {
  return (
    value === "new" ||
    value === "under3" ||
    value === "from3to5" ||
    value === "from5to7" ||
    value === "over7"
  );
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
  return (
    typeof value === "string" &&
    (value === "china" ||
      value === "korea" ||
      value === "kyrgyzstan" ||
      isCustomOriginId(value))
  );
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
      customsPrice:
        typeof parsed.customsPrice === "string" ? parsed.customsPrice : DEFAULT_STATE.customsPrice,
      currency: isCurrency(parsed.currency) ? parsed.currency : DEFAULT_STATE.currency,
      chinaExpensesCny:
        typeof parsed.chinaExpensesCny === "string"
          ? parsed.chinaExpensesCny
          : DEFAULT_STATE.chinaExpensesCny,
      cityDeliveryUsd:
        typeof parsed.cityDeliveryUsd === "string"
          ? parsed.cityDeliveryUsd
          : DEFAULT_STATE.cityDeliveryUsd,
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
      kyrgyzstanCustomsCleared:
        typeof parsed.kyrgyzstanCustomsCleared === "boolean"
          ? parsed.kyrgyzstanCustomsCleared
          : DEFAULT_STATE.kyrgyzstanCustomsCleared,
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
          customsPrice:
            typeof item.customsPrice === "string" ? item.customsPrice : DEFAULT_STATE.customsPrice,
          currency: isCurrency(item.currency) ? item.currency : DEFAULT_STATE.currency,
          chinaExpensesCny:
            typeof item.chinaExpensesCny === "string"
              ? item.chinaExpensesCny
              : DEFAULT_STATE.chinaExpensesCny,
          cityDeliveryUsd:
            typeof item.cityDeliveryUsd === "string"
              ? item.cityDeliveryUsd
              : DEFAULT_STATE.cityDeliveryUsd,
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
          kyrgyzstanCustomsCleared:
            typeof item.kyrgyzstanCustomsCleared === "boolean"
              ? item.kyrgyzstanCustomsCleared
              : DEFAULT_STATE.kyrgyzstanCustomsCleared,
        } satisfies UserPreset;
      })
      .slice(0, MAX_USER_PRESETS);
  } catch {
    return [];
  }
}

function clearLocalPresetsCache() {
  try {
    localStorage.removeItem(PRESETS_STORAGE_KEY);
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
  { value: "new", label: "Новый авто" },
  { value: "under3", label: "до 3 лет" },
  { value: "from3to5", label: "от 3х до 5 лет" },
  { value: "from5to7", label: "от 5 до 7 лет" },
  { value: "over7", label: "более 7 лет" },
];

const ENGINE_OPTIONS: Array<{ value: EngineType; label: string }> = [
  { value: "petrol", label: "Бензин / Дизель" },
  { value: "electric", label: "Электро и последовательный гибрид" },
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
  return age === "new" ? "5000" : "12000";
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
    customsPrice:
      typeof input.customsPrice === "number" &&
      Number.isFinite(input.customsPrice) &&
      input.customsPrice > 0
        ? String(input.customsPrice)
        : "",
    currency: isCurrency(input.currency) ? input.currency : DEFAULT_STATE.currency,
    chinaExpensesCny: numberToInputString(input.chinaExpensesCny, chinaExpensesForAge(age)),
    cityDeliveryUsd: numberToInputString(
      input.cityDeliveryUsd,
      DEFAULT_STATE.cityDeliveryUsd,
    ),
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
    kyrgyzstanCustomsCleared:
      originCountry === "kyrgyzstan" ? input.kyrgyzstanCustomsCleared !== false : true,
    rates: roundExchangeRates({
      ...DEFAULT_EXCHANGE_RATES,
      ...(input.rates ?? {}),
    }),
    ratesUpdatedAt: null,
    submitted: true,
  };
}

function originCountryLabel(
  origin: OriginCountry,
  customOrigins: CustomCalculatorOrigin[] = [],
): string {
  if (origin === "korea") return "Корея";
  if (origin === "kyrgyzstan") return "Киргизия";
  if (origin === "china") return "Китай";
  return customOrigins.find((item) => item.id === origin)?.label ?? origin;
}

function formatForeignNote(amount: number, code: "CNY" | "KRW" | "USD"): string | undefined {
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
  code: "CNY" | "KRW" | "USD",
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
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-muted/10">
      <div className="flex items-start gap-2 px-4 py-3">
        <CollapsibleTrigger open={open} onToggle={onToggle} className="min-w-0 flex-1 px-0 py-0">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{title}</p>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </CollapsibleTrigger>
        {actions}
      </div>
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
  const canvas = await captureResultCanvas(element, 5);
  downloadBlob(exportFilename("jpg"), canvas.toDataURL("image/jpeg", 1));
}

async function canvasToJpegFile(canvas: HTMLCanvasElement, filename: string): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Не удалось подготовить изображение"));
      },
      "image/jpeg",
      1,
    );
  });
  return new File([blob], filename, { type: "image/jpeg" });
}

function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return false;
  }
  // Проверка поддержки файлов: canShare есть не везде, на iOS обычно работает share с File
  if (typeof navigator.canShare !== "function") {
    return true;
  }
  try {
    return navigator.canShare({
      files: [new File(["x"], "probe.jpg", { type: "image/jpeg" })],
    });
  } catch {
    return false;
  }
}

async function shareResultAsJpeg(element: HTMLElement) {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    throw new Error("На этом устройстве шаринг недоступен");
  }

  const canvas = await captureResultCanvas(element, 5);
  const file = await canvasToJpegFile(canvas, exportFilename("jpg"));
  const data: ShareData = {
    files: [file],
    title: "Расчёт растаможки",
    text: "Расчёт растаможки из ImportCRM",
  };

  if (typeof navigator.canShare === "function" && !navigator.canShare(data)) {
    throw new Error("Устройство не умеет отправлять файлы в мессенджеры");
  }

  await navigator.share(data);
}

async function saveResultAsPdf(element: HTMLElement) {
  const canvas = await captureResultCanvas(element, 4);
  const { jsPDF } = await import("jspdf");
  // PNG даёт более чёткий текст в PDF, чем JPEG
  const imgData = canvas.toDataURL("image/png");
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
  pdf.addImage(imgData, "PNG", x, y, imgWidth, imgHeight);
  pdf.save(exportFilename("pdf"));
}

export function CustomsCalculator() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [shareSupported, setShareSupported] = useState(false);
  const role = getClientRoleName(user);
  const canEditExpenseTemplate = role ? canManageCompanyCalculator(role) : false;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [originCountry, setOriginCountry] = useState<OriginCountry>(DEFAULT_STATE.originCountry);
  const [importer, setImporter] = useState<ImporterType>(DEFAULT_STATE.importer);
  const [age, setAge] = useState<CarAge>(DEFAULT_STATE.age);
  const [engine, setEngine] = useState<EngineType>(DEFAULT_STATE.engine);
  const [powerHp, setPowerHp] = useState(DEFAULT_STATE.powerHp);
  const [volumeCc, setVolumeCc] = useState(DEFAULT_STATE.volumeCc);
  const [price, setPrice] = useState(DEFAULT_STATE.price);
  const [customsPrice, setCustomsPrice] = useState(DEFAULT_STATE.customsPrice);
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_STATE.currency);
  const [chinaExpensesCny, setChinaExpensesCny] = useState(DEFAULT_STATE.chinaExpensesCny);
  const [cityDeliveryUsd, setCityDeliveryUsd] = useState(DEFAULT_STATE.cityDeliveryUsd);
  const [koreaDocsDeliveryKrw, setKoreaDocsDeliveryKrw] = useState(
    DEFAULT_STATE.koreaDocsDeliveryKrw,
  );
  const [parkingFeeKrw, setParkingFeeKrw] = useState(DEFAULT_STATE.parkingFeeKrw);
  const [brokerFeeRub, setBrokerFeeRub] = useState(DEFAULT_STATE.brokerFeeRub);
  const [deliveryRoute, setDeliveryRoute] = useState<DeliveryRoute>(DEFAULT_STATE.deliveryRoute);
  const [deliveryRub, setDeliveryRub] = useState(DEFAULT_STATE.deliveryRub);
  const [deliveryUsd, setDeliveryUsd] = useState(DEFAULT_STATE.deliveryUsd);
  const [escortRub, setEscortRub] = useState(DEFAULT_STATE.escortRub);
  const [kyrgyzstanCustomsCleared, setKyrgyzstanCustomsCleared] = useState(
    DEFAULT_STATE.kyrgyzstanCustomsCleared,
  );
  const [expenseTemplate, setExpenseTemplate] = useState<CalculatorExpenseItem[]>(
    getDefaultCompanyCalculatorExpenses,
  );
  const [customOrigins, setCustomOrigins] = useState<CustomCalculatorOrigin[]>([]);
  const [extraAmounts, setExtraAmounts] = useState<Record<string, string>>({});
  const [editingExpenses, setEditingExpenses] = useState(false);
  const [rates, setRates] = useState<ExchangeRates>(DEFAULT_STATE.rates);
  const [submitted, setSubmitted] = useState(DEFAULT_STATE.submitted);
  const [hydrated, setHydrated] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "jpeg" | "share" | null>(null);
  const [history, setHistory] = useState<CalculatorHistoryItem[]>([]);
  const [userPresets, setUserPresets] = useState<UserPreset[]>([]);
  const [presetsSaving, setPresetsSaving] = useState(false);
  const [presetsLoaded, setPresetsLoaded] = useState(false);
  const [exportLogoUrl, setExportLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [autoOpen, setAutoOpen] = useState(true);
  const [expensesOpen, setExpensesOpen] = useState(true);
  const [ratesOpen, setRatesOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
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
    setCustomsPrice(stored.customsPrice);
    setCurrency(stored.currency);
    setChinaExpensesCny(stored.chinaExpensesCny);
    setCityDeliveryUsd(stored.cityDeliveryUsd);
    setKoreaDocsDeliveryKrw(stored.koreaDocsDeliveryKrw);
    setParkingFeeKrw(stored.parkingFeeKrw);
    setBrokerFeeRub(stored.brokerFeeRub);
    setDeliveryRoute(stored.deliveryRoute);
    setDeliveryRub(stored.deliveryRub);
    setDeliveryUsd(stored.deliveryUsd);
    setEscortRub(stored.escortRub);
    setKyrgyzstanCustomsCleared(stored.kyrgyzstanCustomsCleared);
    setRates(stored.rates);
    setRatesUpdatedAt(stored.ratesUpdatedAt);
    setSubmitted(stored.submitted);
    setHistory(loadCalculatorHistory());
    setHydrated(true);
  }, []);

  useEffect(() => {
    setShareSupported(canShareFiles());
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    void api.calculatorSettings
      .get()
      .then(async (settings) => {
        if (cancelled) return;

        let presets = settings.presets;
        if (presets.length === 0) {
          const localPresets = loadUserPresets();
          if (localPresets.length > 0) {
            const migrated = await api.calculatorSettings.savePresets(localPresets);
            presets = migrated.presets;
            clearLocalPresetsCache();
            toast.success("Шаблоны перенесены в аккаунт");
          }
        } else {
          clearLocalPresetsCache();
        }

        if (cancelled) return;
        setUserPresets(presets);
        setExportLogoUrl(settings.exportLogoUrl);
        setPresetsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setUserPresets(loadUserPresets());
          setPresetsLoaded(true);
          toast.error("Не удалось загрузить шаблоны аккаунта");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    void api.calculatorExpenseTemplate
      .get()
      .then((settings) => {
        if (cancelled) return;
        setExpenseTemplate(settings.expenseItems);
        setCustomOrigins(settings.customOrigins ?? []);
        setExtraAmounts((prev) => {
          const next = { ...prev };
          for (const item of settings.expenseItems.filter((row) => row.role === "extra")) {
            if (next[item.id] === undefined) {
              next[item.id] = String(item.defaultAmount);
            }
          }
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setExpenseTemplate(getDefaultCompanyCalculatorExpenses());
          setCustomOrigins([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  const expenseRoles = useMemo(() => {
    return {
      chinaLocal: findExpenseByRole(expenseTemplate, "china_local", originCountry),
      cityDelivery: findExpenseByRole(expenseTemplate, "city_delivery", originCountry),
      koreaParking: findExpenseByRole(expenseTemplate, "korea_parking", originCountry),
      koreaDocs: findExpenseByRole(expenseTemplate, "korea_docs", originCountry),
      broker: findExpenseByRole(expenseTemplate, "broker", originCountry),
      delivery: findExpenseByRole(expenseTemplate, "delivery", originCountry),
      deliveryUsd: findExpenseByRole(expenseTemplate, "delivery_usd", originCountry),
      escort: findExpenseByRole(expenseTemplate, "escort", originCountry),
    };
  }, [expenseTemplate, originCountry]);

  const extraExpenseItems = useMemo(
    () => listExtraExpenses(expenseTemplate, originCountry),
    [expenseTemplate, originCountry],
  );

  const amountOrZero = (enabled: boolean, raw: string) => {
    if (!enabled) return 0;
    const value = Number(raw.replace(",", "."));
    return Number.isFinite(value) && value >= 0 ? value : 0;
  };

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
      customsPrice,
      currency,
      chinaExpensesCny,
      cityDeliveryUsd,
      koreaDocsDeliveryKrw,
      parkingFeeKrw,
      brokerFeeRub,
      deliveryRoute,
      deliveryRub,
      deliveryUsd,
      escortRub,
      kyrgyzstanCustomsCleared,
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
    customsPrice,
    currency,
    chinaExpensesCny,
    cityDeliveryUsd,
    koreaDocsDeliveryKrw,
    parkingFeeKrw,
    brokerFeeRub,
    deliveryRoute,
    deliveryRub,
    deliveryUsd,
    escortRub,
    kyrgyzstanCustomsCleared,
    rates,
    ratesUpdatedAt,
    submitted,
  ]);

  const result = useMemo(() => {
    if (!submitted) return null;
    const customsPriceNumber = Number(customsPrice.replace(",", "."));
    return calculateCustoms({
      originCountry,
      importer,
      age,
      engine,
      powerHp: Number(powerHp.replace(",", ".")),
      volumeCc: Number(volumeCc.replace(",", ".")),
      price: Number(price.replace(",", ".")),
      customsPrice:
        age === "new" && Number.isFinite(customsPriceNumber) && customsPriceNumber > 0
          ? customsPriceNumber
          : undefined,
      currency,
      rates,
      chinaExpensesCny: amountOrZero(Boolean(expenseRoles.chinaLocal), chinaExpensesCny),
      cityDeliveryUsd: amountOrZero(Boolean(expenseRoles.cityDelivery), cityDeliveryUsd),
      koreaDocsDeliveryKrw: amountOrZero(Boolean(expenseRoles.koreaDocs), koreaDocsDeliveryKrw),
      parkingFeeKrw: amountOrZero(Boolean(expenseRoles.koreaParking), parkingFeeKrw),
      brokerFeeRub: amountOrZero(Boolean(expenseRoles.broker), brokerFeeRub),
      deliveryRoute,
      deliveryRub: amountOrZero(Boolean(expenseRoles.delivery), deliveryRub),
      deliveryUsd: amountOrZero(Boolean(expenseRoles.deliveryUsd), deliveryUsd),
      escortRub: amountOrZero(Boolean(expenseRoles.escort), escortRub),
      kyrgyzstanCustomsCleared: isKyrgyzstanOrigin(originCountry)
        ? kyrgyzstanCustomsCleared
        : undefined,
      extraExpenses: extraExpenseItems.map((item) => ({
        id: item.id,
        label: item.label,
        amount: amountOrZero(true, extraAmounts[item.id] ?? String(item.defaultAmount)),
        currency: item.currency,
      })),
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
    customsPrice,
    currency,
    rates,
    chinaExpensesCny,
    cityDeliveryUsd,
    koreaDocsDeliveryKrw,
    parkingFeeKrw,
    brokerFeeRub,
    deliveryRoute,
    deliveryRub,
    deliveryUsd,
    escortRub,
    kyrgyzstanCustomsCleared,
    expenseRoles,
    extraExpenseItems,
    extraAmounts,
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
      customsPrice,
      currency,
      chinaExpensesCny,
      cityDeliveryUsd,
      koreaDocsDeliveryKrw,
      parkingFeeKrw,
      brokerFeeRub,
      deliveryRoute,
      deliveryRub,
      deliveryUsd,
      escortRub,
      kyrgyzstanCustomsCleared,
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
      customsPrice,
      currency,
      chinaExpensesCny,
      cityDeliveryUsd,
      koreaDocsDeliveryKrw,
      parkingFeeKrw,
      brokerFeeRub,
      deliveryRoute,
      deliveryRub,
      deliveryUsd,
      escortRub,
      kyrgyzstanCustomsCleared,
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
    customsPrice,
    currency,
    chinaExpensesCny,
    cityDeliveryUsd,
    koreaDocsDeliveryKrw,
    parkingFeeKrw,
    brokerFeeRub,
    deliveryRoute,
    deliveryRub,
    deliveryUsd,
    escortRub,
    kyrgyzstanCustomsCleared,
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

  const handleExport = async (format: "pdf" | "jpeg" | "share") => {
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
      } else if (format === "share") {
        await shareResultAsJpeg(element);
      } else {
        await saveResultAsJpeg(element);
        toast.success("JPEG сохранён");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // Пользователь закрыл системное меню шаринга
        return;
      }
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить файл");
    } finally {
      setExporting(null);
      // Не закрываем сразу — иначе на экране «скачут» шрифты/высота блока
      if (!wasDetailsOpen) {
        window.setTimeout(() => setDetailsOpen(false), 200);
      }
    }
  };

  const handleExpenseTemplateSaved = (
    items: CalculatorExpenseItem[],
    nextCustomOrigins?: CustomCalculatorOrigin[],
  ) => {
    setExpenseTemplate(items);
    if (nextCustomOrigins) {
      setCustomOrigins(nextCustomOrigins);
      if (
        isCustomOriginId(originCountry) &&
        !nextCustomOrigins.some((origin) => origin.id === originCountry)
      ) {
        setOriginCountry("china");
      }
    }
    setExtraAmounts((prev) => {
      const next = { ...prev };
      for (const item of items.filter((row) => row.role === "extra")) {
        if (next[item.id] === undefined) {
          next[item.id] = String(item.defaultAmount);
        }
      }
      return next;
    });

    const broker = findExpenseByRole(items, "broker", originCountry);
    const delivery = findExpenseByRole(items, "delivery", originCountry);
    const deliveryUsdItem = findExpenseByRole(items, "delivery_usd", originCountry);
    const escort = findExpenseByRole(items, "escort", originCountry);
    const chinaLocal = findExpenseByRole(items, "china_local", originCountry);
    const cityDelivery = findExpenseByRole(items, "city_delivery", originCountry);
    const koreaParking = findExpenseByRole(items, "korea_parking", originCountry);
    const koreaDocs = findExpenseByRole(items, "korea_docs", originCountry);

    if (broker) setBrokerFeeRub(String(broker.defaultAmount));
    if (delivery) setDeliveryRub(String(delivery.defaultAmount));
    if (deliveryUsdItem) setDeliveryUsd(String(deliveryUsdItem.defaultAmount));
    if (escort) setEscortRub(String(escort.defaultAmount));
    if (cityDelivery) setCityDeliveryUsd(String(cityDelivery.defaultAmount));
    if (isChinaLikeOrigin(originCountry) && chinaLocal) {
      setChinaExpensesCny(chinaExpensesForAge(age));
    }
    if (originCountry === "korea") {
      if (koreaParking) setParkingFeeKrw(String(koreaParking.defaultAmount));
      if (koreaDocs) setKoreaDocsDeliveryKrw(String(koreaDocs.defaultAmount));
    }

    setEditingExpenses(false);
    setExpensesOpen(true);
  };

  const handleAgeChange = (next: CarAge) => {
    setAge(next);
    if (next !== "new") {
      setCustomsPrice("");
    }
    if (isChinaLikeOrigin(originCountry) && expenseRoles.chinaLocal) {
      setChinaExpensesCny(chinaExpensesForAge(next));
    }
  };

  const handleOriginChange = (next: OriginCountry) => {
    setOriginCountry(next);
    const broker = findExpenseByRole(expenseTemplate, "broker", next);
    const delivery = findExpenseByRole(expenseTemplate, "delivery", next);
    const deliveryUsdItem = findExpenseByRole(expenseTemplate, "delivery_usd", next);
    const escort = findExpenseByRole(expenseTemplate, "escort", next);
    const chinaLocal = findExpenseByRole(expenseTemplate, "china_local", next);
    const cityDelivery = findExpenseByRole(expenseTemplate, "city_delivery", next);
    const koreaParking = findExpenseByRole(expenseTemplate, "korea_parking", next);
    const koreaDocs = findExpenseByRole(expenseTemplate, "korea_docs", next);

    if (next === "korea") {
      setCurrency("KRW");
      setBrokerFeeRub(String(broker?.defaultAmount ?? 0));
      setDeliveryRoute("vladivostok");
      setDeliveryRub(String(delivery?.defaultAmount ?? 0));
      setParkingFeeKrw(String(koreaParking?.defaultAmount ?? 0));
      setKoreaDocsDeliveryKrw(String(koreaDocs?.defaultAmount ?? 0));
    } else if (next === "kyrgyzstan") {
      setCurrency("USD");
      setKyrgyzstanCustomsCleared(true);
      setBrokerFeeRub(String(broker?.defaultAmount ?? 0));
      setDeliveryRoute("ussuriysk");
      setDeliveryRub("0");
      setCityDeliveryUsd(String(cityDelivery?.defaultAmount ?? DEFAULT_KYRGYZSTAN_CITY_DELIVERY_USD));
    } else {
      setCurrency(defaultInputCurrencyForOrigin(next, customOrigins));
      setBrokerFeeRub(String(broker?.defaultAmount ?? 0));
      setDeliveryRoute("ussuriysk");
      setDeliveryRub(String(delivery?.defaultAmount ?? 0));
      setDeliveryUsd(String(deliveryUsdItem?.defaultAmount ?? KAZAKHSTAN_DELIVERY_USD));
      setChinaExpensesCny(chinaLocal ? chinaExpensesForAge(age) : "0");
    }
    setEscortRub(String(escort?.defaultAmount ?? 0));
  };

  const applyScenario = (scenario: Partial<CalculatorPersistedState>) => {
    if (scenario.originCountry) setOriginCountry(scenario.originCountry);
    if (scenario.importer) setImporter(scenario.importer);
    if (scenario.age) setAge(scenario.age);
    if (scenario.engine) setEngine(scenario.engine);
    if (scenario.powerHp !== undefined) setPowerHp(scenario.powerHp);
    if (scenario.volumeCc !== undefined) setVolumeCc(scenario.volumeCc);
    if (scenario.price !== undefined) setPrice(scenario.price);
    if (scenario.customsPrice !== undefined) {
      setCustomsPrice(scenario.customsPrice);
    } else if (scenario.age !== undefined && scenario.age !== "new") {
      setCustomsPrice("");
    } else if (scenario.price !== undefined) {
      setCustomsPrice("");
    }
    if (scenario.currency) setCurrency(scenario.currency);
    if (scenario.chinaExpensesCny !== undefined) setChinaExpensesCny(scenario.chinaExpensesCny);
    if (scenario.cityDeliveryUsd !== undefined) setCityDeliveryUsd(scenario.cityDeliveryUsd);
    if (scenario.koreaDocsDeliveryKrw !== undefined) {
      setKoreaDocsDeliveryKrw(scenario.koreaDocsDeliveryKrw);
    }
    if (scenario.parkingFeeKrw !== undefined) setParkingFeeKrw(scenario.parkingFeeKrw);
    if (scenario.brokerFeeRub !== undefined) setBrokerFeeRub(scenario.brokerFeeRub);
    if (scenario.deliveryRoute) setDeliveryRoute(scenario.deliveryRoute);
    if (scenario.deliveryRub !== undefined) setDeliveryRub(scenario.deliveryRub);
    if (scenario.deliveryUsd !== undefined) setDeliveryUsd(scenario.deliveryUsd);
    if (scenario.escortRub !== undefined) setEscortRub(scenario.escortRub);
    if (scenario.kyrgyzstanCustomsCleared !== undefined) {
      setKyrgyzstanCustomsCleared(scenario.kyrgyzstanCustomsCleared);
    }
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
    toast.success(`Шаблон «${preset.name}» применён`);
  };

  const persistPresets = async (next: UserPreset[], successMessage?: string) => {
    const withoutRates = next.slice(0, MAX_USER_PRESETS).map((preset) => {
      const { rates: _ignored, ...rest } = preset;
      return rest;
    });
    setUserPresets(withoutRates);
    setPresetsSaving(true);
    try {
      const saved = await api.calculatorSettings.savePresets(withoutRates);
      setUserPresets(saved.presets);
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить шаблоны");
      try {
        const fresh = await api.calculatorSettings.get();
        setUserPresets(fresh.presets);
        setExportLogoUrl(fresh.exportLogoUrl);
      } catch {
        // ignore reload error
      }
    } finally {
      setPresetsSaving(false);
    }
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) {
      toast.error("Введите название шаблона");
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
      customsPrice,
      currency,
      chinaExpensesCny,
      cityDeliveryUsd,
      koreaDocsDeliveryKrw,
      parkingFeeKrw,
      brokerFeeRub,
      deliveryRoute,
      deliveryRub,
      deliveryUsd,
      escortRub,
      kyrgyzstanCustomsCleared,
    };

    const next = [preset, ...userPresets.filter((item) => item.name !== preset.name)].slice(
      0,
      MAX_USER_PRESETS,
    );
    setPresetDialogOpen(false);
    setPresetName("");
    void persistPresets(next, "Шаблон сохранён в аккаунт");
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

  const handleLogoUpload = async (file: File | null) => {
    if (!file) return;
    setLogoUploading(true);
    try {
      const settings = await api.calculatorSettings.uploadLogo(file);
      setExportLogoUrl(settings.exportLogoUrl);
      toast.success("Логотип добавлен в отчёт");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить логотип");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoDelete = async () => {
    setLogoUploading(true);
    try {
      const settings = await api.calculatorSettings.deleteLogo();
      setExportLogoUrl(settings.exportLogoUrl);
      toast.success("Логотип удалён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить логотип");
    } finally {
      setLogoUploading(false);
    }
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
    setRates((current) => ({ ...current, [key]: roundExchangeRate(next, key) }));
  };

  const powerHpNumber = Number(powerHp.replace(",", "."));
  const volumeCcNumber = Number(volumeCc.replace(",", "."));
  const isElectric = normalizeEngine(engine) === "electric";
  const isKorea = originCountry === "korea";
  const isKyrgyzstan = originCountry === "kyrgyzstan";
  const isChina = isChinaLikeOrigin(originCountry);
  const originOptions = useMemo(() => buildOriginOptions(customOrigins), [customOrigins]);
  const displayRateCode = useMemo((): CurrencyCode => {
    if (isKorea) return "KRW";
    if (currency === "RUB" || currency === "USD" || currency === "CNY" || currency === "KRW") {
      return currency;
    }
    return defaultInputCurrencyForOrigin(originCountry, customOrigins);
  }, [isKorea, currency, originCountry, customOrigins]);
  const foreignRateCode =
    displayRateCode === "RUB" ? null : (displayRateCode as "CNY" | "KRW" | "USD");
  const displayRateValue =
    displayRateCode === "RUB"
      ? 1
      : rates[displayRateCode as keyof ExchangeRates];
  const showsCommercialRecyclingHint =
    importer === "personal" &&
    Number.isFinite(powerHpNumber) &&
    ((isElectric && powerHpNumber > PREFERENTIAL_MAX_HP_EV) ||
      (!isElectric &&
        (powerHpNumber > PREFERENTIAL_MAX_HP_ICE ||
          (Number.isFinite(volumeCcNumber) && volumeCcNumber > PREFERENTIAL_MAX_VOLUME_CC))));

  const chinaHint =
    age === "new"
      ? "По умолчанию 5 000 CNY для нового авто"
      : "По умолчанию 12 000 CNY для авто до 3 лет и старше";

  const kazakhstanDeliveryRub =
    Math.round(Number(deliveryUsd.replace(",", ".")) * rates.USD * 100) / 100;

  const calculatorInput: CustomsCalculatorInput = {
    originCountry,
    importer,
    age,
    engine,
    powerHp: Number(powerHp.replace(",", ".")),
    volumeCc: Number(volumeCc.replace(",", ".")),
    price: Number(price.replace(",", ".")),
    customsPrice: (() => {
      if (age !== "new") return undefined;
      const value = Number(customsPrice.replace(",", "."));
      return Number.isFinite(value) && value > 0 ? value : undefined;
    })(),
    currency,
    rates,
    chinaExpensesCny: amountOrZero(Boolean(expenseRoles.chinaLocal), chinaExpensesCny),
    cityDeliveryUsd: amountOrZero(Boolean(expenseRoles.cityDelivery), cityDeliveryUsd),
    koreaDocsDeliveryKrw: amountOrZero(Boolean(expenseRoles.koreaDocs), koreaDocsDeliveryKrw),
    parkingFeeKrw: amountOrZero(Boolean(expenseRoles.koreaParking), parkingFeeKrw),
    brokerFeeRub: amountOrZero(Boolean(expenseRoles.broker), brokerFeeRub),
    deliveryRoute,
    deliveryRub: amountOrZero(Boolean(expenseRoles.delivery), deliveryRub),
    deliveryUsd: amountOrZero(Boolean(expenseRoles.deliveryUsd), deliveryUsd),
    escortRub: amountOrZero(Boolean(expenseRoles.escort), escortRub),
    kyrgyzstanCustomsCleared: isKyrgyzstan ? kyrgyzstanCustomsCleared : undefined,
    extraExpenses: extraExpenseItems.map((item) => ({
      id: item.id,
      label: item.label,
      amount: amountOrZero(true, extraAmounts[item.id] ?? String(item.defaultAmount)),
      currency: item.currency,
    })),
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
          <CalculatorPresetsPanel
            presets={userPresets}
            saving={presetsSaving || !presetsLoaded}
            onApply={applyUserPreset}
            onChange={(next) => {
              void persistPresets(next);
            }}
            onSaveCurrent={() => {
              setPresetName("");
              setPresetDialogOpen(true);
            }}
          />

          <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Сохранить шаблон</DialogTitle>
                <DialogDescription>
                  Сохранятся текущие параметры расчёта. Шаблон будет доступен в вашем аккаунте на
                  любом устройстве.
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
                <Button
                  type="button"
                  variant="brand"
                  className="w-full"
                  disabled={presetsSaving}
                  onClick={handleSavePreset}
                >
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
                  {originOptions.map((option) => (
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

            {age === "new" && (
              <div className="space-y-2">
                <Label htmlFor="customs-price">Стоимость для таможни</Label>
                <Input
                  id="customs-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={customsPrice}
                  onChange={(event) => setCustomsPrice(event.target.value)}
                  placeholder="Необязательно"
                />
                <FieldHint>
                  Если таможня берёт стоимость из каталога, укажите её здесь — сбор, пошлина и НДС
                  посчитаются от этой суммы. Стоимость автомобиля для оплаты останется прежней.
                </FieldHint>
              </div>
            )}

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

            {isKyrgyzstan && (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
                  checked={kyrgyzstanCustomsCleared}
                  onChange={(event) => setKyrgyzstanCustomsCleared(event.target.checked)}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium leading-snug">Автомобиль растаможен</span>
                  <FieldHint>
                    Если авто уже растаможено, таможенная пошлина не включается в расчёт. Снимите
                    галочку, чтобы посчитать пошлину.
                  </FieldHint>
                </span>
              </label>
            )}
          </FormSection>

          <FormSection
            title="2. Расходы"
            subtitle={
              editingExpenses
                ? "Редактирование шаблона компании: добавление и удаление полей"
                : isKorea
                  ? "Стоянка, документы, брокер, доставка и доп. расходы компании"
                  : isKyrgyzstan
                    ? "Доставка до города, брокер, сопровождение и доп. расходы компании"
                    : "Китай, брокер, доставка и доп. расходы компании"
            }
            open={expensesOpen}
            onToggle={() => setExpensesOpen((value) => !value)}
            actions={
              canEditExpenseTemplate ? (
                <Button
                  type="button"
                  variant={editingExpenses ? "secondary" : "outline"}
                  size="sm"
                  className="shrink-0"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setExpensesOpen(true);
                    setEditingExpenses((value) => !value);
                  }}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  {editingExpenses ? "К расчёту" : "Редактировать"}
                </Button>
              ) : undefined
            }
          >
            {editingExpenses ? (
              <CalculatorExpenseEditor
                embedded
                initialItems={expenseTemplate}
                initialCustomOrigins={customOrigins}
                initialOrigin={
                  originCountry === "korea" || originCountry === "kyrgyzstan"
                    ? originCountry
                    : isCustomOriginId(originCountry)
                      ? originCountry
                      : "china"
                }
                onSaved={(items, nextOrigins) => handleExpenseTemplateSaved(items, nextOrigins)}
                onCancel={() => setEditingExpenses(false)}
              />
            ) : (
              <>
            {isKorea ? (
              <>
                {expenseRoles.koreaParking && (
                  <div className="space-y-2">
                    <Label htmlFor="parking-fee">
                      {expenseRoles.koreaParking.label}, {expenseRoles.koreaParking.currency}
                    </Label>
                    <Input
                      id="parking-fee"
                      type="number"
                      min={0}
                      step="1"
                      value={parkingFeeKrw}
                      onChange={(event) => setParkingFeeKrw(event.target.value)}
                    />
                    <FieldHint>
                      По умолчанию{" "}
                      {expenseRoles.koreaParking.defaultAmount.toLocaleString("ru-RU")}{" "}
                      {expenseRoles.koreaParking.currency}
                    </FieldHint>
                  </div>
                )}
                {expenseRoles.koreaDocs && (
                  <div className="space-y-2">
                    <Label htmlFor="korea-docs">
                      {expenseRoles.koreaDocs.label}, {expenseRoles.koreaDocs.currency}
                    </Label>
                    <Input
                      id="korea-docs"
                      type="number"
                      min={0}
                      step="1"
                      value={koreaDocsDeliveryKrw}
                      onChange={(event) => setKoreaDocsDeliveryKrw(event.target.value)}
                    />
                    <FieldHint>
                      По умолчанию{" "}
                      {expenseRoles.koreaDocs.defaultAmount.toLocaleString("ru-RU")}{" "}
                      {expenseRoles.koreaDocs.currency}
                    </FieldHint>
                  </div>
                )}
              </>
            ) : isKyrgyzstan ? (
              expenseRoles.cityDelivery && (
                <div className="space-y-2">
                  <Label htmlFor="city-delivery">
                    {expenseRoles.cityDelivery.label}, {expenseRoles.cityDelivery.currency}
                  </Label>
                  <Input
                    id="city-delivery"
                    type="number"
                    min={0}
                    step="0.01"
                    value={cityDeliveryUsd}
                    onChange={(event) => setCityDeliveryUsd(event.target.value)}
                  />
                  <FieldHint>
                    По умолчанию{" "}
                    {expenseRoles.cityDelivery.defaultAmount.toLocaleString("ru-RU")}{" "}
                    {expenseRoles.cityDelivery.currency}
                  </FieldHint>
                </div>
              )
            ) : (
              expenseRoles.chinaLocal && (
                <div className="space-y-2">
                  <Label htmlFor="china-expenses">
                    {expenseRoles.chinaLocal.label}, {expenseRoles.chinaLocal.currency}
                  </Label>
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
              )
            )}

            {expenseRoles.broker && (
              <div className="space-y-2">
                <Label htmlFor="broker-fee">
                  {expenseRoles.broker.label}, {expenseRoles.broker.currency}
                </Label>
                <Input
                  id="broker-fee"
                  type="number"
                  min={0}
                  step="1"
                  value={brokerFeeRub}
                  onChange={(event) => setBrokerFeeRub(event.target.value)}
                />
                <FieldHint>
                  По умолчанию {expenseRoles.broker.defaultAmount.toLocaleString("ru-RU")}{" "}
                  {expenseRoles.broker.currency}
                </FieldHint>
              </div>
            )}

            {isKorea ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {expenseRoles.delivery && (
                  <div className="space-y-2">
                    <Label htmlFor="delivery-rub">
                      {expenseRoles.delivery.label}, {expenseRoles.delivery.currency}
                    </Label>
                    <Input
                      id="delivery-rub"
                      type="number"
                      min={0}
                      step="1"
                      value={deliveryRub}
                      onChange={(event) => setDeliveryRub(event.target.value)}
                    />
                    <FieldHint>
                      По умолчанию{" "}
                      {expenseRoles.delivery.defaultAmount.toLocaleString("ru-RU")}{" "}
                      {expenseRoles.delivery.currency}
                    </FieldHint>
                  </div>
                )}
                {expenseRoles.escort && (
                  <div className="space-y-2">
                    <Label htmlFor="escort-rub">
                      {expenseRoles.escort.label}, {expenseRoles.escort.currency}
                    </Label>
                    <Input
                      id="escort-rub"
                      type="number"
                      min={0}
                      step="1"
                      value={escortRub}
                      onChange={(event) => setEscortRub(event.target.value)}
                    />
                  </div>
                )}
              </div>
            ) : isKyrgyzstan ? (
              expenseRoles.escort && (
                <div className="space-y-2">
                  <Label htmlFor="escort-rub">
                    {expenseRoles.escort.label}, {expenseRoles.escort.currency}
                  </Label>
                  <Input
                    id="escort-rub"
                    type="number"
                    min={0}
                    step="1"
                    value={escortRub}
                    onChange={(event) => setEscortRub(event.target.value)}
                  />
                </div>
              )
            ) : (
              <>
                {(expenseRoles.delivery || expenseRoles.deliveryUsd) && (
                  <div className="space-y-2">
                    <Label>Доставка</Label>
                    <Select
                      value={deliveryRoute}
                      onValueChange={(value) => {
                        const next = value as DeliveryRoute;
                        setDeliveryRoute(next);
                        if (next === "kazakhstan" && !deliveryUsd.trim()) {
                          setDeliveryUsd(
                            String(
                              expenseRoles.deliveryUsd?.defaultAmount ?? KAZAKHSTAN_DELIVERY_USD,
                            ),
                          );
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
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    {deliveryRoute === "kazakhstan" ? (
                      expenseRoles.deliveryUsd ? (
                        <>
                          <Label htmlFor="delivery-usd">
                            {expenseRoles.deliveryUsd.label}, {expenseRoles.deliveryUsd.currency}
                          </Label>
                          <Input
                            id="delivery-usd"
                            type="number"
                            min={0}
                            step="0.01"
                            value={deliveryUsd}
                            onChange={(event) => setDeliveryUsd(event.target.value)}
                          />
                          <FieldHint>
                            По умолчанию{" "}
                            {expenseRoles.deliveryUsd.defaultAmount.toLocaleString("ru-RU")} USD
                            {Number.isFinite(kazakhstanDeliveryRub)
                              ? ` ≈ ${kazakhstanDeliveryRub.toLocaleString("ru-RU", {
                                  maximumFractionDigits: 0,
                                })} ₽`
                              : ""}
                          </FieldHint>
                        </>
                      ) : null
                    ) : (
                      expenseRoles.delivery && (
                        <>
                          <Label htmlFor="delivery-rub">
                            {expenseRoles.delivery.label}, {expenseRoles.delivery.currency}
                          </Label>
                          <Input
                            id="delivery-rub"
                            type="number"
                            min={0}
                            step="1"
                            value={deliveryRub}
                            onChange={(event) => setDeliveryRub(event.target.value)}
                          />
                        </>
                      )
                    )}
                  </div>
                  {expenseRoles.escort && (
                    <div className="space-y-2">
                      <Label htmlFor="escort-rub">
                        {expenseRoles.escort.label}, {expenseRoles.escort.currency}
                      </Label>
                      <Input
                        id="escort-rub"
                        type="number"
                        min={0}
                        step="1"
                        value={escortRub}
                        onChange={(event) => setEscortRub(event.target.value)}
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {extraExpenseItems.map((item) => (
              <div key={item.id} className="space-y-2">
                <Label htmlFor={`extra-expense-${item.id}`}>
                  {item.label}, {item.currency}
                </Label>
                <Input
                  id={`extra-expense-${item.id}`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={extraAmounts[item.id] ?? String(item.defaultAmount)}
                  onChange={(event) =>
                    setExtraAmounts((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                />
              </div>
            ))}
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
                    min={code === "KRW" ? 0.001 : 0.01}
                    step={code === "KRW" ? "0.001" : "0.01"}
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
              : isKyrgyzstan
                ? kyrgyzstanCustomsCleared
                  ? "Все суммы в рублях. Итог с комиссией ВТБ = (авто + доставка до города) + 2%. Авто растаможено — таможенная пошлина не считается, только утилизационный сбор."
                  : "Все суммы в рублях. Итог с комиссией ВТБ = (авто + доставка до города) + 2%. Авто не растаможено — в расчёт включены таможенная пошлина и утилизационный сбор."
                : "Все суммы в рублях. Итог с комиссией ВТБ = (авто + расходы страны) + 2%."}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="brand">{originCountryLabel(originCountry, customOrigins)}</Badge>
            <Badge variant="outline">
              Курс {displayRateCode}:{" "}
              {displayRateValue.toLocaleString("ru-RU", {
                maximumFractionDigits: exchangeRateDecimals(displayRateCode),
                minimumFractionDigits: exchangeRateDecimals(displayRateCode),
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
                {isMobile && shareSupported && (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={exporting !== null}
                    onClick={() => void handleExport("share")}
                  >
                    {exporting === "share" ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Share2 className="mr-1.5 h-4 w-4" />
                    )}
                    Поделиться
                  </Button>
                )}
              </div>

              <div className="rounded-xl border px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Логотип в отчёте</p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPEG или WebP до 2 МБ. Сохраняется в аккаунте.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={logoUploading || exporting !== null}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {logoUploading ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {exportLogoUrl ? "Заменить" : "Загрузить"}
                    </Button>
                    {exportLogoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={logoUploading || exporting !== null}
                        onClick={() => void handleLogoDelete()}
                      >
                        Удалить
                      </Button>
                    )}
                  </div>
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.target.value = "";
                    void handleLogoUpload(file);
                  }}
                />
                {exportLogoUrl && (
                  <div className="mt-3 rounded-lg border bg-muted/10 px-3 py-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${EXPORT_LOGO_SRC}?v=${encodeURIComponent(exportLogoUrl)}`}
                      alt="Логотип для отчёта"
                      className="h-12 w-auto max-w-[220px] object-contain"
                    />
                  </div>
                )}
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
                      {isKorea
                        ? "Инвойс, таможня, доставка"
                        : isKyrgyzstan
                          ? "ВТБ, утильсбор, сопровождение"
                          : "ВТБ, таможня, доставка"}
                    </p>
                  </div>
                </CollapsibleTrigger>
                <CollapsiblePanel open={detailsOpen}>
                  <div ref={exportRef} className="space-y-2 bg-background px-3 pb-3">
                    {exportLogoUrl && (
                      <div className="pb-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`${EXPORT_LOGO_SRC}?v=${encodeURIComponent(exportLogoUrl)}`}
                          alt=""
                          className="h-14 w-auto max-w-[240px] object-contain"
                        />
                      </div>
                    )}
                    <div className="border-b border-border/40 pb-1.5">
                      <p className="text-sm font-semibold">
                        Расчёт растаможки · {originCountryLabel(originCountry, customOrigins)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Курс {displayRateCode}:{" "}
                        {displayRateValue.toLocaleString("ru-RU", {
                          maximumFractionDigits: exchangeRateDecimals(displayRateCode),
                          minimumFractionDigits: exchangeRateDecimals(displayRateCode),
                        })}{" "}
                        ₽
                      </p>
                    </div>

                    <ResultSection compact>
                      <ResultRow
                        compact
                        label="Стоимость авто в рублях"
                        value={result.priceRub}
                        note={
                          foreignRateCode
                            ? formatForeignNote(
                                priceToForeign(
                                  calculatorInput.price,
                                  currency,
                                  result.priceRub,
                                  rates,
                                  foreignRateCode,
                                ),
                                foreignRateCode,
                              )
                            : undefined
                        }
                      />
                      {result.customsPriceRub != null && result.customsPriceRub > 0 && (
                        <ResultRow
                          compact
                          label="Стоимость для таможни"
                          value={result.customsPriceRub}
                          note={
                            foreignRateCode
                              ? formatForeignNote(
                                  priceToForeign(
                                    calculatorInput.customsPrice ?? 0,
                                    currency,
                                    result.customsPriceRub,
                                    rates,
                                    foreignRateCode,
                                  ),
                                  foreignRateCode,
                                )
                              : undefined
                          }
                        />
                      )}
                      {isKorea ? (
                        <>
                          {result.parkingFeeRub > 0 && (
                            <ResultRow
                              compact
                              label={expenseRoles.koreaParking?.label ?? "Комиссия стоянки"}
                              value={result.parkingFeeRub}
                              note={formatForeignNote(result.parkingFeeKrw, "KRW")}
                            />
                          )}
                          {result.koreaDocsDeliveryRub > 0 && (
                            <ResultRow
                              compact
                              label={
                                expenseRoles.koreaDocs?.label ?? "Документы и доставка до РФ"
                              }
                              value={result.koreaDocsDeliveryRub}
                              note={formatForeignNote(result.koreaDocsDeliveryKrw, "KRW")}
                            />
                          )}
                          <ResultRow
                            compact
                            label={result.firstPaymentLabel}
                            value={result.vtbTotalRub}
                            note={result.firstPaymentNote}
                            emphasize
                          />
                        </>
                      ) : isKyrgyzstan ? (
                        <>
                          {result.cityDeliveryRub > 0 && (
                            <ResultRow
                              compact
                              label={
                                expenseRoles.cityDelivery?.label ?? "Доставка до города"
                              }
                              value={result.cityDeliveryRub}
                              note={formatForeignNote(result.cityDeliveryUsd, "USD")}
                            />
                          )}
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
                          {result.chinaExpensesRub > 0 && (
                            <ResultRow
                              compact
                              label={expenseRoles.chinaLocal?.label ?? "Расходы по Китаю"}
                              value={result.chinaExpensesRub}
                              note={formatForeignNote(result.chinaExpensesCny, "CNY")}
                            />
                          )}
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
                      {result.brokerFeeRub > 0 && (
                        <ResultRow
                          compact
                          label={expenseRoles.broker?.label ?? "Услуги брокера"}
                          value={result.brokerFeeRub}
                        />
                      )}
                      {!isKyrgyzstan && (
                        <ResultRow compact label="Таможенный сбор (ТС)" value={result.customsFee} />
                      )}
                      {(!isKyrgyzstan || !kyrgyzstanCustomsCleared) && (
                        <ResultRow
                          compact
                          label="Таможенная пошлина (ТП)"
                          value={result.customsDuty}
                          note={result.customsDutyNote}
                        />
                      )}
                      <ResultRow
                        compact
                        label="Утилизационный сбор (УС)"
                        value={result.recyclingFee}
                        note={result.recyclingNote}
                      />
                      {!isKyrgyzstan && (
                        <>
                          <ResultRow compact label="Акциз (А)" value={result.excise} />
                          <ResultRow
                            compact
                            label="НДС"
                            value={result.vat}
                            note={
                              result.customsPriceRub != null
                                ? "20% от (стоимость для таможни + пошлина + акциз)"
                                : "20% от (стоимость + пошлина + акциз)"
                            }
                          />
                        </>
                      )}
                    </ResultSection>

                    <ResultSection
                      compact
                      title={
                        isKyrgyzstan
                          ? "Услуги сопровождения"
                          : "Доставка и доп. расходы"
                      }
                    >
                      {!isKyrgyzstan && result.deliveryRub > 0 && (
                        <ResultRow
                          compact
                          label={
                            deliveryRoute === "kazakhstan"
                              ? expenseRoles.deliveryUsd?.label ?? "Доставка"
                              : expenseRoles.delivery?.label ?? "Доставка"
                          }
                          value={result.deliveryRub}
                          note={result.deliveryNote}
                        />
                      )}
                      {result.escortRub > 0 && (
                        <ResultRow
                          compact
                          label={expenseRoles.escort?.label ?? "Услуги сопровождения"}
                          value={result.escortRub}
                        />
                      )}
                      {result.extraExpenses.map((item) => (
                        <ResultRow
                          key={item.id}
                          compact
                          label={item.label}
                          value={item.amountRub}
                        />
                      ))}
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
                                {originCountryLabel(item.originCountry, customOrigins)} ·{" "}
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
        <div
          className={cn(
            "fixed inset-x-0 z-40 border-t bg-card/95 p-3 backdrop-blur xl:hidden",
            MOBILE_TAB_BAR_OFFSET_CLASS,
          )}
        >
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
