"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  FolderPlus,
  Import,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiRequestError } from "@/lib/api-client";
import type { CatalogSelectionListItem, CatalogVehicleListItem } from "@/lib/types/catalog";
import { cn, formatCurrency } from "@/lib/utils";

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include" });
  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new ApiRequestError(json.error ?? "Ошибка запроса", response.status);
  }
  return json.data as T;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new ApiRequestError(json.error ?? "Ошибка запроса", response.status);
  }
  return json.data as T;
}

function formatCny(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString("ru-RU")} ¥`;
}

function VehicleCard({ vehicle }: { vehicle: CatalogVehicleListItem }) {
  const image = vehicle.coverImageUrl ?? vehicle.galleryUrls[0] ?? null;
  return (
    <Link href={`/catalog/${vehicle.id}`} className="group block">
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        <div className="relative aspect-[4/3] bg-muted">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={vehicle.titleRu} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Нет фото
            </div>
          )}
          {vehicle.source === "CHE168" && (
            <Badge className="absolute left-2 top-2" variant="secondary">
              Che168
            </Badge>
          )}
        </div>
        <CardContent className="space-y-2 p-4">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-brand">
            {vehicle.titleRu || vehicle.titleZh}
          </h3>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {vehicle.carYear && <span>{vehicle.carYear} г.</span>}
            {vehicle.mileageKm != null && (
              <span>{vehicle.mileageKm.toLocaleString("ru-RU")} км</span>
            )}
            {vehicle.brand && <span>{vehicle.brand}</span>}
          </div>
          <div className="flex items-end justify-between gap-2">
            <p className="text-sm font-medium">{formatCny(vehicle.priceCny)}</p>
            {vehicle.estimate?.totalWithCar != null && (
              <p className="text-xs text-muted-foreground">
                ≈ {formatCurrency(vehicle.estimate.totalWithCar)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SelectionCard({ selection }: { selection: CatalogSelectionListItem }) {
  const preview = selection.items.slice(0, 3);
  return (
    <Link href={`/catalog/selections/${selection.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold">{selection.title}</h3>
              <p className="text-xs text-muted-foreground">
                {selection.items.length} авто · {selection.createdByName}
              </p>
            </div>
            {selection.shareTokens.some((t) => t.active) && (
              <Badge variant="outline">Есть ссылка</Badge>
            )}
          </div>
          <div className="flex -space-x-2">
            {preview.map((item) =>
              item.vehicle.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={item.id}
                  src={item.vehicle.coverImageUrl}
                  alt=""
                  className="h-10 w-10 rounded-full border-2 border-card object-cover"
                />
              ) : null,
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function CatalogPageContent() {
  const router = useRouter();
  const [tab, setTab] = useState("vehicles");
  const [vehicles, setVehicles] = useState<CatalogVehicleListItem[]>([]);
  const [selections, setSelections] = useState<CatalogSelectionListItem[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [selectionTitle, setSelectionTitle] = useState("");
  const [proxyOk, setProxyOk] = useState<boolean | null>(null);
  const [filters, setFilters] = useState({
    q: "",
    brand: "",
    yearFrom: "",
    yearTo: "",
    priceFrom: "",
    priceTo: "",
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.brand) params.set("brand", filters.brand);
    if (filters.yearFrom) params.set("yearFrom", filters.yearFrom);
    if (filters.yearTo) params.set("yearTo", filters.yearTo);
    if (filters.priceFrom) params.set("priceFrom", filters.priceFrom);
    if (filters.priceTo) params.set("priceTo", filters.priceTo);
    return params.toString();
  }, [filters]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [vehiclesData, selectionsData, brandsData, proxyData] = await Promise.all([
        apiGet<{ items: CatalogVehicleListItem[] }>(`/api/catalog/vehicles?${queryString}`),
        apiGet<CatalogSelectionListItem[]>("/api/catalog/selections"),
        apiGet<string[]>("/api/catalog/brands"),
        apiGet<{ ok: boolean; message: string }>("/api/catalog/proxy-health").catch(() => ({
          ok: false,
          message: "Не удалось проверить прокси",
        })),
      ]);
      setVehicles(vehiclesData.items);
      setSelections(selectionsData);
      setBrands(brandsData);
      setProxyOk(proxyData.ok);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить каталог");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleImport() {
    if (!importUrl.trim()) return;
    setImporting(true);
    try {
      const result = await apiPost<{ vehicle: CatalogVehicleListItem; created: boolean }>(
        "/api/catalog/vehicles/import-che168",
        { url: importUrl.trim(), translate: true },
      );
      toast.success(result.created ? "Объявление импортировано" : "Объявление обновлено");
      setImportOpen(false);
      setImportUrl("");
      router.push(`/catalog/${result.vehicle.id}`);
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Ошибка импорта");
    } finally {
      setImporting(false);
    }
  }

  async function handleCreateSelection() {
    if (!selectionTitle.trim()) return;
    try {
      const selection = await apiPost<CatalogSelectionListItem>("/api/catalog/selections", {
        title: selectionTitle.trim(),
      });
      toast.success("Подборка создана");
      setSelectionOpen(false);
      setSelectionTitle("");
      router.push(`/catalog/selections/${selection.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось создать подборку");
    }
  }

  return (
    <>
      <Header
        title="Каталог"
        subtitle="Авто из Китая: импорт Che168, подборки и расчёт цены"
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} />
            Обновить
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Import className="mr-1.5 h-4 w-4" />
            Che168
          </Button>
          <Button size="sm" onClick={() => setSelectionOpen(true)}>
            <FolderPlus className="mr-1.5 h-4 w-4" />
            Подборка
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {proxyOk === true ? (
            <Badge variant="outline" className="gap-1 text-emerald-600">
              <Wifi className="h-3.5 w-3.5" />
              Прокси для Che168 OK
            </Badge>
          ) : proxyOk === false ? (
            <Badge variant="outline" className="gap-1 text-amber-600">
              <WifiOff className="h-3.5 w-3.5" />
              Прокси недоступен — импорт может не работать
            </Badge>
          ) : null}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="vehicles">Авто</TabsTrigger>
            <TabsTrigger value="selections">Подборки</TabsTrigger>
          </TabsList>

          <TabsContent value="vehicles" className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
                <div className="relative lg:col-span-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Поиск..."
                    value={filters.q}
                    onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                  />
                </div>
                <Input
                  placeholder="Марка"
                  list="catalog-brands"
                  value={filters.brand}
                  onChange={(e) => setFilters((f) => ({ ...f, brand: e.target.value }))}
                />
                <datalist id="catalog-brands">
                  {brands.map((brand) => (
                    <option key={brand} value={brand} />
                  ))}
                </datalist>
                <Input
                  placeholder="Год от"
                  inputMode="numeric"
                  value={filters.yearFrom}
                  onChange={(e) => setFilters((f) => ({ ...f, yearFrom: e.target.value }))}
                />
                <Input
                  placeholder="Год до"
                  inputMode="numeric"
                  value={filters.yearTo}
                  onChange={(e) => setFilters((f) => ({ ...f, yearTo: e.target.value }))}
                />
                <Input
                  placeholder="Цена ¥ до"
                  inputMode="numeric"
                  value={filters.priceTo}
                  onChange={(e) => setFilters((f) => ({ ...f, priceTo: e.target.value }))}
                />
              </CardContent>
            </Card>

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : vehicles.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <p className="text-muted-foreground">Пока нет объявлений</p>
                  <Button onClick={() => setImportOpen(true)}>
                    <Import className="mr-2 h-4 w-4" />
                    Импорт с Che168
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {vehicles.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="selections" className="space-y-4">
            {selections.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <p className="text-muted-foreground">Подборок пока нет</p>
                  <Button onClick={() => setSelectionOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Создать подборку
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {selections.map((selection) => (
                  <SelectionCard key={selection.id} selection={selection} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Импорт с Che168</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="che168-url">Ссылка на объявление</Label>
            <Input
              id="che168-url"
              placeholder="https://www.che168.com/dealer/..."
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Страница загружается через прокси сервера (TELEGRAM_PROXY_URL). Описание переводится
              на русский автоматически.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => void handleImport()} disabled={importing || !importUrl.trim()}>
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Импортировать
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={selectionOpen} onOpenChange={setSelectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новая подборка</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="selection-title">Название</Label>
            <Input
              id="selection-title"
              placeholder="Подборка для Иванова"
              value={selectionTitle}
              onChange={(e) => setSelectionTitle(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelectionOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => void handleCreateSelection()} disabled={!selectionTitle.trim()}>
              Создать
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
