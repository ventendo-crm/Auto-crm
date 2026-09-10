"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FolderPlus,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Table2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError } from "@/lib/api-client";
import { mediaVideoPreviewSrc } from "@/components/media/media-thumb";
import {
  DEFAULT_EXCHANGE_RATES,
  roundExchangeRates,
  type ExchangeRates,
} from "@/lib/customs-calculator/rates";
import type {
  CatalogRatesRecalcResult,
  CatalogSectionItem,
  CatalogSectionsList,
  CatalogVehicleListItem,
} from "@/lib/types/catalog";
import { minCatalogTrimTotal } from "@/lib/catalog/trims";
import { cn, formatCurrency } from "@/lib/utils";

const CATALOG_VIEW_STORAGE = "crm-catalog-view";
const CATALOG_SECTIONS_OPEN_STORAGE = "crm-catalog-sections-open";
type CatalogView = "cards" | "table";

function loadCatalogView(): CatalogView {
  try {
    return localStorage.getItem(CATALOG_VIEW_STORAGE) === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
}

function saveCatalogView(view: CatalogView) {
  try {
    localStorage.setItem(CATALOG_VIEW_STORAGE, view);
  } catch {
    // ignore
  }
}

function loadCatalogSectionsOpen(): boolean {
  try {
    const raw = localStorage.getItem(CATALOG_SECTIONS_OPEN_STORAGE);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    // ignore
  }
  return false;
}

function saveCatalogSectionsOpen(open: boolean) {
  try {
    localStorage.setItem(CATALOG_SECTIONS_OPEN_STORAGE, open ? "1" : "0");
  } catch {
    // ignore
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include" });
  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new ApiRequestError(json.error ?? "Ошибка запроса", response.status);
  }
  return json.data as T;
}

async function apiSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || (json.success === false)) {
    throw new ApiRequestError(json.error ?? "Ошибка запроса", response.status);
  }
  return json.data as T;
}

const RATE_CODES = ["USD", "EUR", "CNY", "KRW"] as const;
type RateDraft = Record<(typeof RATE_CODES)[number], string>;

function ratesToDraft(rates: ExchangeRates): RateDraft {
  return {
    USD: String(rates.USD),
    EUR: String(rates.EUR),
    CNY: String(rates.CNY),
    KRW: String(rates.KRW),
  };
}

function parseRateDraft(draft: RateDraft): ExchangeRates | null {
  const parsed = {
    USD: Number(draft.USD.replace(",", ".")),
    EUR: Number(draft.EUR.replace(",", ".")),
    CNY: Number(draft.CNY.replace(",", ".")),
    KRW: Number(draft.KRW.replace(",", ".")),
  };
  if (RATE_CODES.some((code) => !Number.isFinite(parsed[code]) || parsed[code] <= 0)) {
    return null;
  }
  return roundExchangeRates(parsed);
}

function vehicleCover(vehicle: CatalogVehicleListItem) {
  const photo = vehicle.photos.find((item) => item.type !== "VIDEO");
  const video = vehicle.photos.find((item) => item.type === "VIDEO");
  return {
    image: photo?.fileUrl ?? vehicle.coverImageUrl ?? vehicle.galleryUrls[0] ?? null,
    videoUrl: video?.fileUrl ?? null,
  };
}

function VehicleThumb({
  vehicle,
  className,
}: {
  vehicle: CatalogVehicleListItem;
  className?: string;
}) {
  const cover = vehicleCover(vehicle);
  if (cover.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cover.image}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  if (cover.videoUrl) {
    return (
      <video
        src={mediaVideoPreviewSrc(cover.videoUrl)}
        muted
        playsInline
        preload="metadata"
        className={cn("h-full w-full bg-slate-900 object-cover", className)}
      />
    );
  }
  return (
    <div className={cn("flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground", className)}>
      Нет фото
    </div>
  );
}

function catalogPriceLabel(vehicle: CatalogVehicleListItem) {
  const priced = minCatalogTrimTotal(vehicle.trims ?? []);
  if (!priced) return "Нет расчёта";
  const label = formatCurrency(priced.min);
  return priced.count > 1 ? `от ${label}` : label;
}

function VehicleCard({ vehicle }: { vehicle: CatalogVehicleListItem }) {
  const cover = vehicleCover(vehicle);
  const trimCount = vehicle.trims?.length ?? 0;
  return (
    <Link href={`/catalog/${vehicle.id}`} className="group block">
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        <div className="relative aspect-[4/3] bg-muted">
          <VehicleThumb vehicle={vehicle} />
          {!cover.image && cover.videoUrl ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
              <span className="rounded-full bg-black/50 px-2 py-1 text-xs text-white">Видео</span>
            </span>
          ) : null}
          {vehicle.sectionTitle && (
            <Badge className="absolute left-2 top-2" variant="secondary">
              {vehicle.sectionTitle}
            </Badge>
          )}
        </div>
        <CardContent className="space-y-2 p-4">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-brand">
            {vehicle.titleRu || vehicle.titleZh}
          </h3>
          <p className="text-base font-semibold">{catalogPriceLabel(vehicle)}</p>
          {trimCount > 1 ? (
            <p className="text-xs text-muted-foreground">{trimCount} комплектации</p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}

function VehicleTable({ vehicles }: { vehicles: CatalogVehicleListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="px-3 py-2.5 font-medium">Авто</th>
            <th className="px-3 py-2.5 font-medium">Раздел</th>
            <th className="px-3 py-2.5 font-medium">Год</th>
            <th className="px-3 py-2.5 text-right font-medium">Итого</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((vehicle) => {
            return (
              <tr key={vehicle.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/40">
                <td className="px-3 py-2">
                  <Link href={`/catalog/${vehicle.id}`} className="flex items-center gap-3">
                    <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                      <VehicleThumb vehicle={vehicle} />
                    </span>
                    <span className="min-w-0 font-medium leading-snug hover:text-brand">
                      {vehicle.titleRu || vehicle.titleZh}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  <Link href={`/catalog/${vehicle.id}`} className="block">
                    {vehicle.sectionTitle ?? "Без раздела"}
                  </Link>
                </td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  <Link href={`/catalog/${vehicle.id}`} className="block">
                    {vehicle.carYear ?? "—"}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  <Link href={`/catalog/${vehicle.id}`} className="block hover:text-brand">
                    {catalogPriceLabel(vehicle)}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CatalogPageContent() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<CatalogVehicleListItem[]>([]);
  const [sections, setSections] = useState<CatalogSectionItem[]>([]);
  const [totalActiveCount, setTotalActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sectionId, setSectionId] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const hasLoadedOnce = useRef(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [rename, setRename] = useState<{ id: string; title: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    titleRu: "",
    descriptionRu: "",
    sectionId: "",
  });
  const [sectionTitle, setSectionTitle] = useState("");
  const [view, setView] = useState<CatalogView>("cards");
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [ratesOpen, setRatesOpen] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [recalculatingRates, setRecalculatingRates] = useState(false);
  const [rateDraft, setRateDraft] = useState<RateDraft>(() => ratesToDraft(DEFAULT_EXCHANGE_RATES));
  const [ratesFetchedAt, setRatesFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    setView(loadCatalogView());
    setSectionsOpen(loadCatalogSectionsOpen());
  }, []);

  function setCatalogView(next: CatalogView) {
    setView(next);
    saveCatalogView(next);
  }

  function setCatalogSectionsOpen(next: boolean) {
    setSectionsOpen(next);
    saveCatalogSectionsOpen(next);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (sectionId !== "all") params.set("sectionId", sectionId);
    params.set("limit", "100");
    return params.toString();
  }, [debouncedQuery, sectionId]);

  const loadData = useCallback(async () => {
    const firstLoad = !hasLoadedOnce.current;
    if (firstLoad) setLoading(true);
    try {
      const vehiclesPromise = apiGet<{ items: CatalogVehicleListItem[] }>(
        `/api/catalog/vehicles?${queryString}`,
      );
      const sectionsPromise = firstLoad
        ? apiGet<CatalogSectionsList>("/api/catalog/sections")
        : Promise.resolve(null);
      const [vehiclesData, sectionsData] = await Promise.all([vehiclesPromise, sectionsPromise]);
      setVehicles(vehiclesData.items);
      if (sectionsData) {
        setSections(sectionsData.items);
        setTotalActiveCount(sectionsData.totalActiveCount);
      }
      hasLoadedOnce.current = true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить каталог");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function loadExchangeRates() {
    setRatesLoading(true);
    try {
      const data = await apiGet<{ rates: ExchangeRates; fetchedAt: string }>(
        "/api/catalog/vehicles/estimates/recalculate",
      );
      setRateDraft(ratesToDraft(roundExchangeRates(data.rates)));
      setRatesFetchedAt(data.fetchedAt);
      toast.success("Курсы обновлены");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить курсы");
    } finally {
      setRatesLoading(false);
    }
  }

  async function handleApplyRates() {
    const rates = parseRateDraft(rateDraft);
    if (!rates) {
      toast.error("Проверьте курсы валют");
      return;
    }

    setRecalculatingRates(true);
    try {
      const result = await apiSend<CatalogRatesRecalcResult>(
        "/api/catalog/vehicles/estimates/recalculate",
        "POST",
        { rates },
      );

      if (result.updated === 0 && result.failed === 0) {
        toast.message("Нет авто с расчётом — пересчитывать нечего");
      } else if (result.failed > 0) {
        toast.warning(
          `Пересчитано: ${result.updated}. Без расчёта: ${result.skipped}. Ошибок: ${result.failed}`,
        );
      } else {
        toast.success(`Пересчитано авто: ${result.updated}`);
      }

      setRatesOpen(false);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось обновить расчёты");
    } finally {
      setRecalculatingRates(false);
    }
  }

  async function handleCreateSection() {
    if (!sectionTitle.trim()) return;
    try {
      const section = await apiSend<CatalogSectionItem>("/api/catalog/sections", "POST", {
        title: sectionTitle.trim(),
      });
      toast.success("Раздел создан");
      setSectionOpen(false);
      setSectionTitle("");
      setSections((current) => [...current, section]);
      setSectionId(section.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось создать раздел");
    }
  }

  async function handleRenameSection() {
    if (!rename?.title.trim()) return;
    try {
      const updated = await apiSend<CatalogSectionItem>(`/api/catalog/sections/${rename.id}`, "PATCH", {
        title: rename.title.trim(),
      });
      setSections((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setRename(null);
      toast.success("Раздел переименован");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить");
    }
  }

  async function handleDeleteSection(id: string) {
    if (!confirm("Удалить раздел? Авто останутся в каталоге без раздела.")) return;
    try {
      await apiSend(`/api/catalog/sections/${id}`, "DELETE");
      setSections((current) => current.filter((item) => item.id !== id));
      if (sectionId === id) setSectionId("all");
      toast.success("Раздел удалён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить");
    }
  }

  async function handleCreateVehicle() {
    if (!form.titleRu.trim()) return;
    setCreating(true);
    try {
      const vehicle = await apiSend<{ id: string }>("/api/catalog/vehicles", "POST", {
        titleRu: form.titleRu.trim(),
        descriptionRu: form.descriptionRu.trim() || undefined,
        sectionId: form.sectionId || null,
      });
      toast.success("Авто добавлено");
      setCreateOpen(false);
      router.push(`/catalog/${vehicle.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось создать");
    } finally {
      setCreating(false);
    }
  }

  const renderSectionsNav = () => (
    <>
      <button
        type="button"
        onClick={() => setSectionId("all")}
        className={cn(
          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm",
          sectionId === "all" ? "bg-brand-muted text-brand" : "hover:bg-muted",
        )}
      >
        Все
        <span className="text-xs text-muted-foreground">{totalActiveCount}</span>
      </button>
      {sections.map((section) => (
        <div key={section.id} className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSectionId(section.id)}
            className={cn(
              "flex min-w-0 flex-1 items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
              sectionId === section.id ? "bg-brand-muted text-brand" : "hover:bg-muted",
            )}
          >
            <span className="truncate">{section.title}</span>
            <span className="ml-2 text-xs text-muted-foreground">{section.vehicleCount}</span>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setRename({ id: section.id, title: section.title })}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => void handleDeleteSection(section.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => setSectionOpen(true)}>
        <FolderPlus className="mr-1.5 h-4 w-4" />
        Раздел
      </Button>
    </>
  );

  return (
    <>
      <Header title="Каталог" subtitle="Новые авто: фото, описание, цена «под ключ» и ссылка клиенту" />

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-56">
          <div className="rounded-xl border bg-muted/10 lg:hidden">
            <div className="flex items-start gap-2 px-4 py-3">
              <CollapsibleTrigger
                open={sectionsOpen}
                onToggle={() => setCatalogSectionsOpen(!sectionsOpen)}
                className="min-w-0 flex-1 px-0 py-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Разделы</p>
                    {sections.length > 0 && (
                      <span className="rounded-md border bg-background px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                        {sections.length}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {sectionsOpen ? "Фильтр списка авто" : "Нажмите, чтобы развернуть"}
                  </p>
                </div>
              </CollapsibleTrigger>
            </div>
            <CollapsiblePanel open={sectionsOpen}>
              <div className="space-y-2 px-4 pb-4">{renderSectionsNav()}</div>
            </CollapsiblePanel>
          </div>

          <div className="hidden space-y-2 lg:block">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Разделы</p>
            {renderSectionsNav()}
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Поиск по названию..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={view === "cards"}
                aria-label="Карточки"
                onClick={() => setCatalogView("cards")}
                className={cn(
                  "h-8 shrink-0 gap-1.5",
                  view === "cards" && "border-brand/40 bg-brand-muted/50 text-foreground shadow-sm",
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Карточки</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={view === "table"}
                aria-label="Таблицей"
                onClick={() => setCatalogView("table")}
                className={cn(
                  "h-8 shrink-0 gap-1.5",
                  view === "table" && "border-brand/40 bg-brand-muted/50 text-foreground shadow-sm",
                )}
              >
                <Table2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Таблицей</span>
              </Button>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setRatesOpen(true)}
              >
                Курс валют
              </Button>
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  setForm({
                    titleRu: "",
                    descriptionRu: "",
                    sectionId: sectionId !== "all" ? sectionId : "",
                  });
                  setCreateOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Добавить авто
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : vehicles.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <p className="text-muted-foreground">Пока нет авто в каталоге</p>
                <Button
                  onClick={() => {
                    setForm({
                      titleRu: "",
                      descriptionRu: "",
                      sectionId: sectionId !== "all" ? sectionId : "",
                    });
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Добавить авто
                </Button>
              </CardContent>
            </Card>
          ) : view === "table" ? (
            <VehicleTable vehicles={vehicles} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {vehicles.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={ratesOpen}
        onOpenChange={(open) => {
          if (recalculatingRates) return;
          setRatesOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Курс валют</DialogTitle>
            <DialogDescription>
              {ratesLoading
                ? "Загрузка…"
                : ratesFetchedAt
                  ? `Обновлено ${new Date(ratesFetchedAt).toLocaleString("ru-RU")}`
                  : "Подтяните курсы из интернета или введите вручную."}{" "}
              «Обновить» пересчитает все авто с уже сохранённым расчётом.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={ratesLoading || recalculatingRates}
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
            {RATE_CODES.map((code) => (
              <div key={code} className="space-y-1.5">
                <Label htmlFor={`catalog-rate-${code}`} className="text-xs text-muted-foreground">
                  {code}, ₽
                </Label>
                <Input
                  id={`catalog-rate-${code}`}
                  type="number"
                  min={code === "KRW" ? 0.001 : 0.01}
                  step={code === "KRW" ? "0.001" : "0.01"}
                  value={rateDraft[code]}
                  disabled={ratesLoading || recalculatingRates}
                  onChange={(event) =>
                    setRateDraft((current) => ({ ...current, [code]: event.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={recalculatingRates}
              onClick={() => setRatesOpen(false)}
            >
              Отмена
            </Button>
            <Button
              onClick={() => void handleApplyRates()}
              disabled={ratesLoading || recalculatingRates || !parseRateDraft(rateDraft)}
            >
              {recalculatingRates ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Обновить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новое авто</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-title">Марка, модель</Label>
              <Input
                id="new-title"
                value={form.titleRu}
                onChange={(event) => setForm((current) => ({ ...current, titleRu: event.target.value }))}
                placeholder="Changan UNI-K"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-section">Раздел</Label>
              <select
                id="new-section"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.sectionId}
                onChange={(event) => setForm((current) => ({ ...current, sectionId: event.target.value }))}
              >
                <option value="">Без раздела</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-desc">Описание</Label>
              <Textarea
                id="new-desc"
                rows={4}
                value={form.descriptionRu}
                onChange={(event) =>
                  setForm((current) => ({ ...current, descriptionRu: event.target.value }))
                }
                placeholder="Комплектация, комментарий клиенту"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Фото, видео и расчёт «под ключ» — в карточке после создания. Калькулятор тот же, что в Подборе.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => void handleCreateVehicle()} disabled={creating || !form.titleRu.trim()}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Создать
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={sectionOpen} onOpenChange={setSectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый раздел</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Кроссоверы"
            value={sectionTitle}
            onChange={(event) => setSectionTitle(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSectionOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => void handleCreateSection()} disabled={!sectionTitle.trim()}>
              Создать
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rename)} onOpenChange={(open) => !open && setRename(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Переименовать раздел</DialogTitle>
          </DialogHeader>
          <Input
            value={rename?.title ?? ""}
            onChange={(event) =>
              setRename((current) => (current ? { ...current, title: event.target.value } : current))
            }
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRename(null)}>
              Отмена
            </Button>
            <Button onClick={() => void handleRenameSection()} disabled={!rename?.title.trim()}>
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
