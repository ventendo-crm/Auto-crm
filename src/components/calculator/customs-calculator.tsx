"use client";

import { Calculator as CalculatorIcon, FileDown, ImageDown, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible-panel";
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
  DEFAULT_BROKER_FEE_RUB,
  DEFAULT_DELIVERY_RUB,
  DEFAULT_ESCORT_RUB,
  DEFAULT_EXCHANGE_RATES,
  EngineType,
  ExchangeRates,
  ImporterType,
  PREFERENTIAL_MAX_HP_EV,
  PREFERENTIAL_MAX_HP_ICE,
  PREFERENTIAL_MAX_VOLUME_CC,
} from "@/lib/customs-calculator";
import { cn, formatCurrency } from "@/lib/utils";
import { SaveEstimateToDealButton } from "@/components/calculator/save-estimate-to-deal-button";

const STORAGE_KEY = "autocrm-customs-calculator";

type CalculatorPersistedState = {
  importer: ImporterType;
  age: CarAge;
  engine: EngineType;
  powerHp: string;
  volumeCc: string;
  price: string;
  currency: CurrencyCode;
  chinaExpensesCny: string;
  brokerFeeRub: string;
  deliveryRub: string;
  escortRub: string;
  rates: ExchangeRates;
  submitted: boolean;
};

const DEFAULT_STATE: CalculatorPersistedState = {
  importer: "personal",
  age: "under3",
  engine: "petrol",
  powerHp: "150",
  volumeCc: "2000",
  price: "25000",
  currency: "USD",
  chinaExpensesCny: "5000",
  brokerFeeRub: String(DEFAULT_BROKER_FEE_RUB),
  deliveryRub: String(DEFAULT_DELIVERY_RUB),
  escortRub: String(DEFAULT_ESCORT_RUB),
  rates: DEFAULT_EXCHANGE_RATES,
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

function loadPersistedState(): CalculatorPersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<CalculatorPersistedState>;
    const rates = {
      ...DEFAULT_EXCHANGE_RATES,
      USD: typeof parsed.rates?.USD === "number" ? parsed.rates.USD : DEFAULT_EXCHANGE_RATES.USD,
      EUR: typeof parsed.rates?.EUR === "number" ? parsed.rates.EUR : DEFAULT_EXCHANGE_RATES.EUR,
      CNY: typeof parsed.rates?.CNY === "number" ? parsed.rates.CNY : DEFAULT_EXCHANGE_RATES.CNY,
      KRW: typeof parsed.rates?.KRW === "number" ? parsed.rates.KRW : DEFAULT_EXCHANGE_RATES.KRW,
    };
    return {
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
      brokerFeeRub:
        typeof parsed.brokerFeeRub === "string" ? parsed.brokerFeeRub : DEFAULT_STATE.brokerFeeRub,
      deliveryRub:
        typeof parsed.deliveryRub === "string" ? parsed.deliveryRub : DEFAULT_STATE.deliveryRub,
      escortRub: typeof parsed.escortRub === "string" ? parsed.escortRub : DEFAULT_STATE.escortRub,
      rates,
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

const CURRENCY_OPTIONS: Array<{ value: CurrencyCode; label: string }> = [
  { value: "RUB", label: "Рубль" },
  { value: "USD", label: "Доллар США" },
  { value: "CNY", label: "Юань" },
  { value: "KRW", label: "Вона" },
];

function chinaExpensesForAge(age: CarAge): string {
  return age === "under3" ? "5000" : "12000";
}

function formatCnyNote(amountCny: number): string | undefined {
  if (!Number.isFinite(amountCny) || amountCny <= 0) return undefined;
  return `${amountCny.toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
  })} CNY`;
}

function priceToCny(
  price: number,
  currency: CurrencyCode,
  priceRub: number,
  rates: ExchangeRates,
): number {
  if (currency === "CNY") return price;
  if (!rates.CNY || rates.CNY <= 0) return 0;
  return priceRub / rates.CNY;
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
        "flex items-start justify-between gap-3 border-b border-border/50 last:border-b-0",
        compact ? "py-1.5" : "py-3",
        emphasize && (compact ? "border-b-0 pt-2" : "border-b-0 pt-4"),
      )}
    >
      <div className="min-w-0">
        <p
          className={cn(
            compact ? "text-xs" : "text-sm",
            emphasize ? "font-semibold" : "text-muted-foreground",
          )}
        >
          {label}
        </p>
        {note && (
          <p className={cn("mt-0.5 text-muted-foreground", compact ? "text-[10px] leading-tight" : "text-xs")}>
            {note}
          </p>
        )}
      </div>
      <p
        className={cn(
          "shrink-0 text-right tabular-nums",
          emphasize
            ? compact
              ? "text-base font-semibold"
              : "text-xl font-semibold"
            : compact
              ? "text-xs font-medium"
              : "text-sm font-medium",
        )}
      >
        {formatCurrency(value)}
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

async function captureResultCanvas(element: HTMLElement) {
  const html2canvas = (await import("html2canvas")).default;
  return html2canvas(element, {
    scale: 1.75,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: (doc, cloned) => {
      doc.documentElement.classList.remove("dark");
      cloned.style.backgroundColor = "#ffffff";
      cloned.style.color = "#1f2937";
    },
  });
}

async function saveResultAsJpeg(element: HTMLElement) {
  const canvas = await captureResultCanvas(element);
  downloadBlob(exportFilename("jpg"), canvas.toDataURL("image/jpeg", 0.92));
}

async function saveResultAsPdf(element: HTMLElement) {
  const canvas = await captureResultCanvas(element);
  const { jsPDF } = await import("jspdf");
  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * usableWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, "JPEG", margin, position, usableWidth, imgHeight);
  heightLeft -= pageHeight - margin * 2;

  while (heightLeft > 0) {
    position = margin - (imgHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", margin, position, usableWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;
  }

  pdf.save(exportFilename("pdf"));
}

export function CustomsCalculator() {
  const [importer, setImporter] = useState<ImporterType>(DEFAULT_STATE.importer);
  const [age, setAge] = useState<CarAge>(DEFAULT_STATE.age);
  const [engine, setEngine] = useState<EngineType>(DEFAULT_STATE.engine);
  const [powerHp, setPowerHp] = useState(DEFAULT_STATE.powerHp);
  const [volumeCc, setVolumeCc] = useState(DEFAULT_STATE.volumeCc);
  const [price, setPrice] = useState(DEFAULT_STATE.price);
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_STATE.currency);
  const [chinaExpensesCny, setChinaExpensesCny] = useState(DEFAULT_STATE.chinaExpensesCny);
  const [brokerFeeRub, setBrokerFeeRub] = useState(DEFAULT_STATE.brokerFeeRub);
  const [deliveryRub, setDeliveryRub] = useState(DEFAULT_STATE.deliveryRub);
  const [escortRub, setEscortRub] = useState(DEFAULT_STATE.escortRub);
  const [rates, setRates] = useState<ExchangeRates>(DEFAULT_STATE.rates);
  const [submitted, setSubmitted] = useState(DEFAULT_STATE.submitted);
  const [hydrated, setHydrated] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "jpeg" | null>(null);
  const [autoOpen, setAutoOpen] = useState(true);
  const [expensesOpen, setExpensesOpen] = useState(true);
  const [ratesOpen, setRatesOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const exportRef = useRef<HTMLDivElement>(null);
  const resultSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = loadPersistedState();
    setImporter(stored.importer);
    setAge(stored.age);
    setEngine(stored.engine);
    setPowerHp(stored.powerHp);
    setVolumeCc(stored.volumeCc);
    setPrice(stored.price);
    setCurrency(stored.currency);
    setChinaExpensesCny(stored.chinaExpensesCny);
    setBrokerFeeRub(stored.brokerFeeRub);
    setDeliveryRub(stored.deliveryRub);
    setEscortRub(stored.escortRub);
    setRates(stored.rates);
    setSubmitted(stored.submitted);
    setHydrated(true);
  }, []);

  const loadExchangeRates = async (force = false) => {
    setRatesLoading(true);
    try {
      const data = await api.exchangeRates.get(force);
      setRates(data.rates);
      setRatesUpdatedAt(data.fetchedAt);
      if (force) {
        toast.success("Курсы обновлены");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось загрузить курсы с Google Finance";
      toast.error(message);
    } finally {
      setRatesLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    void loadExchangeRates(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только после гидрации
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    savePersistedState({
      importer,
      age,
      engine,
      powerHp,
      volumeCc,
      price,
      currency,
      chinaExpensesCny,
      brokerFeeRub,
      deliveryRub,
      escortRub,
      rates,
      submitted,
    });
  }, [
    hydrated,
    importer,
    age,
    engine,
    powerHp,
    volumeCc,
    price,
    currency,
    chinaExpensesCny,
    brokerFeeRub,
    deliveryRub,
    escortRub,
    rates,
    submitted,
  ]);

  const result = useMemo(() => {
    if (!submitted) return null;
    return calculateCustoms({
      importer,
      age,
      engine,
      powerHp: Number(powerHp.replace(",", ".")),
      volumeCc: Number(volumeCc.replace(",", ".")),
      price: Number(price.replace(",", ".")),
      currency,
      rates,
      chinaExpensesCny: Number(chinaExpensesCny.replace(",", ".")),
      brokerFeeRub: Number(brokerFeeRub.replace(",", ".")),
      deliveryRub: Number(deliveryRub.replace(",", ".")),
      escortRub: Number(escortRub.replace(",", ".")),
    });
  }, [
    submitted,
    importer,
    age,
    engine,
    powerHp,
    volumeCc,
    price,
    currency,
    rates,
    chinaExpensesCny,
    brokerFeeRub,
    deliveryRub,
    escortRub,
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
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
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
      if (!wasDetailsOpen) setDetailsOpen(false);
    }
  };

  const handleAgeChange = (next: CarAge) => {
    setAge(next);
    setChinaExpensesCny(chinaExpensesForAge(next));
  };

  const updateRate = (key: keyof ExchangeRates, value: string) => {
    const next = Number(value.replace(",", "."));
    if (!Number.isFinite(next) || next <= 0) return;
    setRates((current) => ({ ...current, [key]: next }));
  };

  const powerHpNumber = Number(powerHp.replace(",", "."));
  const volumeCcNumber = Number(volumeCc.replace(",", "."));
  const isElectric = normalizeEngine(engine) === "electric";
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

  const calculatorInput = {
    importer,
    age,
    engine,
    powerHp: Number(powerHp.replace(",", ".")),
    volumeCc: Number(volumeCc.replace(",", ".")),
    price: Number(price.replace(",", ".")),
    currency,
    rates,
    chinaExpensesCny: Number(chinaExpensesCny.replace(",", ".")),
    brokerFeeRub: Number(brokerFeeRub.replace(",", ".")),
    deliveryRub: Number(deliveryRub.replace(",", ".")),
    escortRub: Number(escortRub.replace(",", ".")),
  };

  return (
    <div
      className={cn(
        "grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]",
        result && result.totalWithCar !== 0 && "pb-24 xl:pb-0",
      )}
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
          <FormSection
            title="1. Автомобиль"
            subtitle="Кто ввозит, возраст, двигатель, цена и мощность"
            open={autoOpen}
            onToggle={() => setAutoOpen((value) => !value)}
          >
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
            subtitle="Китай, брокер, доставка и сопровождение"
            open={expensesOpen}
            onToggle={() => setExpensesOpen((value) => !value)}
          >
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="delivery-rub">Доставка по РФ, ₽</Label>
                <Input
                  id="delivery-rub"
                  type="number"
                  min={0}
                  step="1"
                  value={deliveryRub}
                  onChange={(event) => setDeliveryRub(event.target.value)}
                />
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
          </FormSection>

          <FormSection
            title="3. Курсы валют"
            subtitle={
              ratesLoading
                ? "Загрузка…"
                : ratesUpdatedAt
                  ? `Обновлено ${new Date(ratesUpdatedAt).toLocaleString("ru-RU")}`
                  : "Подставляются автоматически"
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
                onClick={() => void loadExchangeRates(true)}
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
                    min={0.0001}
                    step="0.0001"
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
            Все суммы в рублях. Итог с комиссией ВТБ = (авто + расходы по Китаю) + 2%.
          </p>
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
                <div className="rounded-xl border border-brand/20 bg-brand-muted/40 px-4 py-5">
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
                    <p className="text-xs text-muted-foreground">ВТБ, таможня, доставка</p>
                  </div>
                </CollapsibleTrigger>
                <CollapsiblePanel open={detailsOpen}>
                  <div ref={exportRef} className="space-y-2 bg-background px-3 pb-3">
                    <div className="border-b border-border/40 pb-1.5">
                      <p className="text-sm font-semibold">Расчёт растаможки</p>
                      <p className="text-[11px] text-muted-foreground">
                        Курс CNY: {rates.CNY.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} ₽
                      </p>
                    </div>

                    <ResultSection compact>
                      <ResultRow
                        compact
                        label="Стоимость авто в рублях"
                        value={result.priceRub}
                        note={formatCnyNote(
                          priceToCny(calculatorInput.price, currency, result.priceRub, rates),
                        )}
                      />
                      <ResultRow
                        compact
                        label="Расходы по Китаю"
                        value={result.chinaExpensesRub}
                        note={formatCnyNote(result.chinaExpensesCny)}
                      />
                      <ResultRow
                        compact
                        label="Итог с комиссией ВТБ"
                        value={result.vtbTotalRub}
                        note="Авто + расходы по Китаю + 2%"
                        emphasize
                      />
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

                    <ResultSection compact title="Доставка по РФ">
                      <ResultRow compact label="Доставка" value={result.deliveryRub} />
                      <ResultRow compact label="Услуги сопровождения" value={result.escortRub} />
                    </ResultSection>

                    {result.totalWithCar !== 0 && (
                      <div className="rounded-lg border border-brand/20 bg-brand-muted/40 px-3 py-2.5">
                        <p className="text-[11px] text-muted-foreground">Итого со всеми расходами</p>
                        <p className="mt-0.5 text-xl font-semibold tabular-nums">
                          {formatCurrency(result.totalWithCar)}
                        </p>
                      </div>
                    )}
                  </div>
                </CollapsiblePanel>
              </div>
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
