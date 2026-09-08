"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  ImagePlus,
  Loader2,
  Play,
  Share2,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CustomsCalculator } from "@/components/calculator/customs-calculator";
import { MediaThumb } from "@/components/media/media-thumb";
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
import { MAX_CATALOG_VEHICLE_MEDIA } from "@/lib/constants";
import { MEDIA_FILE_ACCEPT } from "@/lib/validators/media";
import { buildTelegramShareUrl } from "@/lib/calculator/offer-share";
import type { CatalogSectionItem, CatalogSectionsList, CatalogVehicleDetail } from "@/lib/types/catalog";
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
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dealOpen, setDealOpen] = useState(false);
  const [deals, setDeals] = useState<DealListItem[]>([]);
  const [selectedDealId, setSelectedDealId] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    titleRu: "",
    descriptionRu: "",
    sectionId: "",
  });

  const loadVehicle = useCallback(async () => {
    setLoading(true);
    try {
      const [data, sectionsData] = await Promise.all([
        apiGet<CatalogVehicleDetail>(`/api/catalog/vehicles/${vehicleId}`),
        apiGet<CatalogSectionsList>("/api/catalog/sections"),
      ]);
      setVehicle(data);
      setSections(sectionsData.items);
      setForm({
        titleRu: data.titleRu,
        descriptionRu: data.descriptionRu,
        sectionId: data.sectionId ?? "",
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

  const mediaItems: Array<{
    id?: string;
    fileUrl: string;
    type: "PHOTO" | "VIDEO";
  }> = vehicle?.photos.length
    ? vehicle.photos.map((item) => ({
        id: item.id,
        fileUrl: item.fileUrl,
        type: item.type ?? "PHOTO",
      }))
    : vehicle?.galleryUrls.length
      ? vehicle.galleryUrls.map((fileUrl) => ({ fileUrl, type: "PHOTO" as const }))
      : vehicle?.coverImageUrl
        ? [{ fileUrl: vehicle.coverImageUrl, type: "PHOTO" as const }]
        : [];
  const currentMedia = mediaItems[activeImage] ?? null;
  const currentMediaId = currentMedia?.id;

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await apiSend<CatalogVehicleDetail>(`/api/catalog/vehicles/${vehicleId}`, "PATCH", {
        titleRu: form.titleRu,
        descriptionRu: form.descriptionRu,
        sectionId: form.sectionId || null,
      });
      setVehicle(saved);
      toast.success("Сохранено");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function handleCalculated(input: CustomsCalculatorInput, calcResult: CustomsCalculatorResult) {
    try {
      const saved = await apiSend<{
        totalWithCar: number;
        input: unknown;
        result: unknown;
      }>(`/api/catalog/vehicles/${vehicleId}/estimate`, "POST", { input });
      setVehicle((current) =>
        current
          ? {
              ...current,
              priceCny: input.price,
              priceCurrency: input.currency,
              powerHp: Math.round(input.powerHp),
              volumeCc: Math.round(input.volumeCc),
              estimate: {
                totalWithCar: saved.totalWithCar ?? calcResult.totalWithCar,
                input: saved.input ?? input,
                result: saved.result ?? calcResult,
              },
            }
          : current,
      );
      toast.success("Расчёт сохранён");
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Не удалось сохранить расчёт");
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

  async function handleMedia(files: FileList | null) {
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
        throw new ApiRequestError(json.error ?? "Не удалось загрузить файлы", response.status);
      }
      setVehicle(json.data as CatalogVehicleDetail);
      toast.success("Файлы добавлены");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить файлы");
    } finally {
      setUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function handleDeleteMedia(mediaId: string, kind: "PHOTO" | "VIDEO" = "PHOTO") {
    if (!confirm(kind === "VIDEO" ? "Удалить это видео?" : "Удалить это фото?")) return;
    setDeletingId(mediaId);
    try {
      const saved = await apiSend<CatalogVehicleDetail>(
        `/api/catalog/vehicles/${vehicleId}/photos/${mediaId}`,
        "DELETE",
      );
      setVehicle(saved);
      setActiveImage((current) => {
        const nextLength = saved.photos.length;
        if (nextLength === 0) return 0;
        return Math.min(current, nextLength - 1);
      });
      toast.success(kind === "VIDEO" ? "Видео удалено" : "Фото удалено");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить файл");
    } finally {
      setDeletingId(null);
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
    if (!confirm("Удалить это авто из каталога? Ссылка для клиента перестанет открываться.")) return;
    try {
      await apiSend(`/api/catalog/vehicles/${vehicleId}`, "PATCH", { status: "ARCHIVED" });
      toast.success("Авто удалено из каталога");
      router.push("/catalog");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить");
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
  const initialInput = (estimate?.input as CustomsCalculatorInput | undefined) ?? null;

  return (
    <>
      <Header
        title={vehicle.titleRu || vehicle.titleZh}
        subtitle={
          estimate?.totalWithCar != null
            ? `${vehicle.sectionTitle ?? "Каталог"} · ${formatCurrency(estimate.totalWithCar)}`
            : (vehicle.sectionTitle ?? "Каталог")
        }
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
            Удалить
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

        <div className="mx-auto max-w-7xl space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <div className="relative aspect-[16/10] bg-muted">
                {currentMedia?.type === "VIDEO" ? (
                  <video
                    src={currentMedia.fileUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-full w-full bg-black object-contain"
                  />
                ) : currentMedia ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentMedia.fileUrl}
                    alt={vehicle.titleRu}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    Нет фото и видео
                  </div>
                )}
                {currentMediaId ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute right-2 top-2 shadow-md"
                    disabled={deletingId === currentMediaId}
                    onClick={() =>
                      void handleDeleteMedia(currentMediaId, currentMedia.type)
                    }
                  >
                    {deletingId === currentMediaId ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1.5 h-4 w-4" />
                    )}
                    Удалить
                  </Button>
                ) : null}
              </div>
              {mediaItems.length > 0 && (
                <div className="flex gap-2 overflow-x-auto p-3">
                  {mediaItems.map((item, index) => {
                    const itemId = item.id;
                    return (
                    <div
                      key={itemId ?? `${item.fileUrl}-${index}`}
                      className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 ${
                        index === activeImage ? "border-brand" : "border-transparent"
                      }`}
                    >
                      <button
                        type="button"
                        className="h-full w-full"
                        onClick={() => setActiveImage(index)}
                      >
                        <MediaThumb
                          item={{
                            type: item.type,
                            fileUrl: item.fileUrl,
                            fileName: vehicle.titleRu,
                          }}
                        />
                        {item.type === "VIDEO" && (
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                            <Play className="h-5 w-5 text-white" />
                          </span>
                        )}
                      </button>
                      {itemId ? (
                        <button
                          type="button"
                          className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 shadow"
                          disabled={deletingId === itemId}
                          title="Удалить"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDeleteMedia(itemId, item.type);
                          }}
                        >
                          {deletingId === itemId ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </button>
                      ) : null}
                    </div>
                    );
                  })}
                </div>
              )}
              <CardContent className="space-y-3 p-4">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept={MEDIA_FILE_ACCEPT}
                  multiple
                  className="hidden"
                  onChange={(event) => void handleMedia(event.target.files)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading || vehicle.photos.length >= MAX_CATALOG_VEHICLE_MEDIA}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="mr-1.5 h-4 w-4" />
                    )}
                    Добавить фото или видео
                  </Button>
                  <p className="self-center text-xs text-muted-foreground">
                    До {MAX_CATALOG_VEHICLE_MEDIA} файлов, видео до 100 МБ. Лишнее уберите крестиком
                    или кнопкой «Удалить».
                  </p>
                </div>
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

          <CustomsCalculator
            key={vehicleId}
            embedded
            persistLocal={false}
            initialInput={initialInput}
            onCalculated={(input, result) => {
              void handleCalculated(input, result);
            }}
          />
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
