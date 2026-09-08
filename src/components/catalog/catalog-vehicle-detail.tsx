"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calculator,
  Copy,
  ImagePlus,
  Loader2,
  Share2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CustomsEstimateSnapshot } from "@/components/calculator/customs-estimate-snapshot";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError } from "@/lib/api-client";
import { MAX_CATALOG_VEHICLE_PHOTOS } from "@/lib/constants";
import { buildTelegramShareUrl } from "@/lib/calculator/offer-share";
import type { CatalogSectionItem, CatalogVehicleDetail } from "@/lib/types/catalog";
import type { DealListItem } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import type {
  CustomsCalculatorInput,
  CustomsCalculatorResult,
} from "@/lib/customs-calculator";

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
  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new ApiRequestError(json.error ?? "Ошибка запроса", response.status);
  }
  return json.data as T;
}

export function CatalogVehicleDetailView({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [vehicle, setVehicle] = useState<CatalogVehicleDetail | null>(null);
  const [sections, setSections] = useState<CatalogSectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [deals, setDeals] = useState<DealListItem[]>([]);
  const [selectedDealId, setSelectedDealId] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    titleRu: "",
    descriptionRu: "",
    sectionId: "",
    carYear: "",
    powerHp: "",
    volumeCc: "",
    priceCny: "",
    priceCurrency: "CNY",
    origin: "china",
  });

  const loadVehicle = useCallback(async () => {
    setLoading(true);
    try {
      const [data, sectionRows] = await Promise.all([
        apiGet<CatalogVehicleDetail>(`/api/catalog/vehicles/${vehicleId}`),
        apiGet<CatalogSectionItem[]>("/api/catalog/sections"),
      ]);
      setVehicle(data);
      setSections(sectionRows);
      const origin =
        data.estimate?.input && typeof data.estimate.input === "object"
          ? String((data.estimate.input as { originCountry?: string }).originCountry ?? "china")
          : "china";
      setForm({
        titleRu: data.titleRu,
        descriptionRu: data.descriptionRu,
        sectionId: data.sectionId ?? "",
        carYear: data.carYear?.toString() ?? "",
        powerHp: data.powerHp?.toString() ?? "",
        volumeCc: data.volumeCc?.toString() ?? "",
        priceCny: data.priceCny?.toString() ?? "",
        priceCurrency: data.priceCurrency || "CNY",
        origin,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить авто");
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    void loadVehicle();
  }, [loadVehicle]);

  const images = vehicle?.photos.length
    ? vehicle.photos.map((item) => item.fileUrl)
    : vehicle?.galleryUrls.length
      ? vehicle.galleryUrls
      : vehicle?.coverImageUrl
        ? [vehicle.coverImageUrl]
        : [];

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await apiSend<CatalogVehicleDetail>(`/api/catalog/vehicles/${vehicleId}`, "PATCH", {
        titleRu: form.titleRu,
        descriptionRu: form.descriptionRu,
        sectionId: form.sectionId || null,
        carYear: form.carYear ? Number(form.carYear) : undefined,
        powerHp: form.powerHp ? Number(form.powerHp) : undefined,
        volumeCc: form.volumeCc ? Number(form.volumeCc) : undefined,
        priceCny: form.priceCny ? Number(form.priceCny) : undefined,
        priceCurrency: form.priceCurrency,
      });
      setVehicle(saved);
      toast.success("Сохранено");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function handleEstimate() {
    setEstimating(true);
    try {
      await apiSend(`/api/catalog/vehicles/${vehicleId}`, "PATCH", {
        carYear: form.carYear ? Number(form.carYear) : undefined,
        powerHp: form.powerHp ? Number(form.powerHp) : undefined,
        volumeCc: form.volumeCc ? Number(form.volumeCc) : undefined,
        priceCny: form.priceCny ? Number(form.priceCny) : undefined,
        priceCurrency: form.priceCurrency,
      });
      await apiSend(`/api/catalog/vehicles/${vehicleId}/estimate`, "POST", {
        destinationCountry: form.origin,
        price: Number(form.priceCny),
        currency: form.priceCurrency,
        powerHp: Number(form.powerHp),
        volumeCc: Number(form.volumeCc),
        carYear: Number(form.carYear),
      });
      toast.success("Расчёт обновлён");
      await loadVehicle();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Не удалось рассчитать");
    } finally {
      setEstimating(false);
    }
  }

  async function handleAutoEstimate() {
    setEstimating(true);
    try {
      const response = await fetch(`/api/catalog/vehicles/${vehicleId}/estimate`, {
        method: "PUT",
        credentials: "include",
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new ApiRequestError(json.error ?? "Не удалось рассчитать", response.status);
      }
      toast.success("Расчёт обновлён");
      await loadVehicle();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Не удалось рассчитать");
    } finally {
      setEstimating(false);
    }
  }

  async function handleShare() {
    setSharing(true);
    try {
      const result = await apiSend<{ url: string; clipboard: string }>(
        `/api/catalog/vehicles/${vehicleId}/share`,
        "POST",
      );
      setShareUrl(result.url);
      await navigator.clipboard.writeText(result.clipboard);
      toast.success("Ссылка скопирована");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось создать ссылку");
    } finally {
      setSharing(false);
    }
  }

  async function handlePhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      const response = await fetch(`/api/catalog/vehicles/${vehicleId}/photos`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new ApiRequestError(json.error ?? "Не удалось загрузить фото", response.status);
      }
      setVehicle(json.data as CatalogVehicleDetail);
      toast.success("Фото добавлены");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить фото");
    } finally {
      setUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function handleDeletePhoto(mediaId: string) {
    try {
      const saved = await apiSend<CatalogVehicleDetail>(
        `/api/catalog/vehicles/${vehicleId}/photos/${mediaId}`,
        "DELETE",
      );
      setVehicle(saved);
      setActiveImage(0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить фото");
    }
  }

  async function openDealDialog() {
    try {
      const data = await apiGet<{ items: DealListItem[] }>("/api/deals?limit=100");
      setDeals(data.items ?? (data as unknown as DealListItem[]));
      setDealOpen(true);
    } catch {
      toast.error("Не удалось загрузить сделки");
    }
  }

  async function handleAddToDeal() {
    if (!selectedDealId) return;
    try {
      const result = await apiSend<{ entryId: string; dealId: string }>(
        `/api/catalog/vehicles/${vehicleId}/add-to-deal`,
        "POST",
        { dealId: selectedDealId, publish: false },
      );
      toast.success("Добавлено в сделку");
      setDealOpen(false);
      router.push(`/deals/${result.dealId}?tab=search`);
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Не удалось добавить");
    }
  }

  async function handleArchive() {
    if (!confirm("Снять авто с витрины?")) return;
    try {
      await apiSend(`/api/catalog/vehicles/${vehicleId}`, "PATCH", { status: "ARCHIVED" });
      toast.success("Снято с витрины");
      router.push("/catalog");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось скрыть");
    }
  }

  if (loading || !vehicle) {
    return (
      <>
        <Header title="Каталог" subtitle="Загрузка..." />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  const estimate = vehicle.estimate;
  const estimateInput = estimate?.input as CustomsCalculatorInput | undefined;
  const estimateResult = estimate?.result as CustomsCalculatorResult | undefined;

  return (
    <>
      <Header
        title={vehicle.titleRu || vehicle.titleZh}
        subtitle={vehicle.sectionTitle ?? "Каталог"}
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/catalog">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Назад
            </Link>
          </Button>
          <Button size="sm" onClick={() => void handleShare()} disabled={sharing}>
            {sharing ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="mr-1.5 h-4 w-4" />
            )}
            Поделиться
          </Button>
          <Button variant="outline" size="sm" onClick={() => void openDealDialog()}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            В сделку
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleArchive()}>
            Снять с витрины
          </Button>
        </div>

        {shareUrl && (
          <Card className="mb-4">
            <CardContent className="flex flex-wrap items-center gap-2 p-3">
              <p className="min-w-0 flex-1 truncate text-sm">{shareUrl}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(shareUrl);
                  toast.success("Ссылка скопирована");
                }}
              >
                <Copy className="mr-1.5 h-4 w-4" />
                Копировать
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={buildTelegramShareUrl(shareUrl, vehicle.titleRu)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть в Telegram
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className="relative aspect-[16/10] bg-muted">
                {images[activeImage] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={images[activeImage]}
                    alt={vehicle.titleRu}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    Нет фото
                  </div>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto p-3">
                  {images.map((url, index) => (
                    <button
                      key={`${url}-${index}`}
                      type="button"
                      onClick={() => setActiveImage(index)}
                      className={`h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 ${
                        index === activeImage ? "border-brand" : "border-transparent"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <CardContent className="space-y-3 p-4">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => void handlePhotos(event.target.files)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading || (vehicle.photos.length >= MAX_CATALOG_VEHICLE_PHOTOS)}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="mr-1.5 h-4 w-4" />
                    )}
                    Добавить фото
                  </Button>
                  <p className="self-center text-xs text-muted-foreground">
                    До {MAX_CATALOG_VEHICLE_PHOTOS} снимков
                  </p>
                </div>
                {vehicle.photos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {vehicle.photos.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        className="relative h-16 w-20 overflow-hidden rounded-md border"
                        onClick={() => void handleDeletePhoto(photo.id)}
                        title="Удалить фото"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.fileUrl} alt="" className="h-full w-full object-cover" />
                        <span className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5">
                          <X className="h-3 w-3" />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Карточка</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title-ru">Марка, модель</Label>
                  <Input
                    id="title-ru"
                    value={form.titleRu}
                    onChange={(event) => setForm((current) => ({ ...current, titleRu: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="section">Раздел</Label>
                  <select
                    id="section"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.sectionId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, sectionId: event.target.value }))
                    }
                  >
                    <option value="">Без раздела</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc-ru">Описание</Label>
                  <Textarea
                    id="desc-ru"
                    rows={8}
                    value={form.descriptionRu}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, descriptionRu: event.target.value }))
                    }
                  />
                </div>
                <Button onClick={() => void handleSave()} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Сохранить
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Цена и расчёт «под ключ»</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="price">Цена авто</Label>
                    <Input
                      id="price"
                      inputMode="decimal"
                      value={form.priceCny}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, priceCny: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="currency">Валюта</Label>
                    <select
                      id="currency"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.priceCurrency}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, priceCurrency: event.target.value }))
                      }
                    >
                      <option value="CNY">CNY</option>
                      <option value="USD">USD</option>
                      <option value="KRW">KRW</option>
                      <option value="RUB">RUB</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="year">Год</Label>
                    <Input
                      id="year"
                      inputMode="numeric"
                      value={form.carYear}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, carYear: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="origin">Страна</Label>
                    <select
                      id="origin"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.origin}
                      onChange={(event) => setForm((current) => ({ ...current, origin: event.target.value }))}
                    >
                      <option value="china">Китай</option>
                      <option value="korea">Корея</option>
                      <option value="kyrgyzstan">Киргизия</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hp">Мощность, л.с.</Label>
                    <Input
                      id="hp"
                      inputMode="numeric"
                      value={form.powerHp}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, powerHp: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cc">Объём, см³</Label>
                    <Input
                      id="cc"
                      inputMode="numeric"
                      value={form.volumeCc}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, volumeCc: event.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void handleEstimate()}
                    disabled={
                      estimating || !form.priceCny || !form.carYear || !form.powerHp || !form.volumeCc
                    }
                  >
                    {estimating ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Calculator className="mr-1.5 h-4 w-4" />
                    )}
                    Рассчитать
                  </Button>
                  <Button variant="outline" onClick={() => void handleAutoEstimate()} disabled={estimating}>
                    Пересчитать
                  </Button>
                </div>
                {estimate?.totalWithCar != null && (
                  <p className="text-xl font-semibold">Итого: {formatCurrency(estimate.totalWithCar)}</p>
                )}
                {estimate && estimateResult && estimateInput ? (
                  <CustomsEstimateSnapshot input={estimateInput} result={estimateResult} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Укажите цену, год, мощность и объём — клиент увидит итоговую сумму в рублях.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={dealOpen} onOpenChange={setDealOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить в сделку</DialogTitle>
          </DialogHeader>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={selectedDealId}
            onChange={(event) => setSelectedDealId(event.target.value)}
          >
            <option value="">Выберите сделку</option>
            {deals.map((deal) => (
              <option key={deal.id} value={deal.id}>
                {deal.clientName} · {deal.carBrand} {deal.carModel}
              </option>
            ))}
          </select>
          <div className="flex justify-end">
            <Button onClick={() => void handleAddToDeal()} disabled={!selectedDealId}>
              Добавить как вариант
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
