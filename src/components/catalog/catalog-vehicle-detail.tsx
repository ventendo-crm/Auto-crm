"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calculator,
  ExternalLink,
  FolderPlus,
  Loader2,
  Share2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { CustomsEstimateSnapshot } from "@/components/calculator/customs-estimate-snapshot";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError } from "@/lib/api-client";
import type { CatalogVehicleDetail } from "@/lib/types/catalog";
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

async function apiPost<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
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

export function CatalogVehicleDetailView({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const [vehicle, setVehicle] = useState<CatalogVehicleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [estimating, setEstimating] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [deals, setDeals] = useState<DealListItem[]>([]);
  const [selectedDealId, setSelectedDealId] = useState("");
  const [selections, setSelections] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedSelectionId, setSelectedSelectionId] = useState("");
  const [editRu, setEditRu] = useState({ titleRu: "", descriptionRu: "" });
  const [saving, setSaving] = useState(false);

  const loadVehicle = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<CatalogVehicleDetail>(`/api/catalog/vehicles/${vehicleId}`);
      setVehicle(data);
      setEditRu({ titleRu: data.titleRu, descriptionRu: data.descriptionRu });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить объявление");
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    void loadVehicle();
  }, [loadVehicle]);

  const images =
    vehicle?.galleryUrls.length
      ? vehicle.galleryUrls
      : vehicle?.coverImageUrl
        ? [vehicle.coverImageUrl]
        : [];

  async function handleAutoEstimate() {
    setEstimating(true);
    try {
      await apiPost(`/api/catalog/vehicles/${vehicleId}/estimate`, undefined, "PUT");
      toast.success("Расчёт обновлён");
      await loadVehicle();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Не удалось рассчитать");
    } finally {
      setEstimating(false);
    }
  }

  async function handleSaveText() {
    setSaving(true);
    try {
      await apiPost(
        `/api/catalog/vehicles/${vehicleId}`,
        { titleRu: editRu.titleRu, descriptionRu: editRu.descriptionRu },
        "PATCH",
      );
      toast.success("Сохранено");
      await loadVehicle();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
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

  async function openSelectionDialog() {
    try {
      const data = await apiGet<Array<{ id: string; title: string }>>("/api/catalog/selections");
      setSelections(data.map((s) => ({ id: s.id, title: s.title })));
      setSelectionOpen(true);
    } catch {
      toast.error("Не удалось загрузить подборки");
    }
  }

  async function handleAddToDeal() {
    if (!selectedDealId) return;
    try {
      const result = await apiPost<{ entryId: string; dealId: string }>(
        `/api/catalog/vehicles/${vehicleId}/add-to-deal`,
        { dealId: selectedDealId, publish: false },
      );
      toast.success("Добавлено в сделку");
      setDealOpen(false);
      router.push(`/deals/${result.dealId}?tab=search`);
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Не удалось добавить");
    }
  }

  async function handleAddToSelection() {
    if (!selectedSelectionId) return;
    try {
      await apiPost(`/api/catalog/selections/${selectedSelectionId}/items`, {
        catalogVehicleId: vehicleId,
      });
      toast.success("Добавлено в подборку");
      setSelectionOpen(false);
      router.push(`/catalog/selections/${selectedSelectionId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось добавить");
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
        subtitle={[vehicle.brand, vehicle.model, vehicle.carYear?.toString()].filter(Boolean).join(" · ")}
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/catalog">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Назад
            </Link>
          </Button>
          {vehicle.sourceUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={vehicle.sourceUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-4 w-4" />
                Che168
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => void openSelectionDialog()}>
            <FolderPlus className="mr-1.5 h-4 w-4" />
            В подборку
          </Button>
          <Button size="sm" onClick={() => void openDealDialog()}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            В сделку
          </Button>
        </div>
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className="aspect-[16/10] bg-muted">
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
                      key={url}
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
            </Card>

            {vehicle.videoUrl && (
              <Card>
                <CardHeader>
                  <CardTitle>Видео</CardTitle>
                </CardHeader>
                <CardContent>
                  <video controls className="w-full rounded-lg" src={vehicle.videoUrl} />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Описание</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title-ru">Название (RU)</Label>
                  <Input
                    id="title-ru"
                    value={editRu.titleRu}
                    onChange={(e) => setEditRu((v) => ({ ...v, titleRu: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc-ru">Описание (RU)</Label>
                  <Textarea
                    id="desc-ru"
                    rows={8}
                    value={editRu.descriptionRu}
                    onChange={(e) => setEditRu((v) => ({ ...v, descriptionRu: e.target.value }))}
                  />
                </div>
                {vehicle.descriptionZh && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground">
                      Оригинал (中文)
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                      {vehicle.descriptionZh}
                    </p>
                  </details>
                )}
                <Button onClick={() => void handleSaveText()} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Сохранить текст
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Характеристики</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Цена в Китае</span>
                  <span className="font-medium">{formatCny(vehicle.priceCny)}</span>
                </div>
                {vehicle.mileageKm != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Пробег</span>
                    <span>{vehicle.mileageKm.toLocaleString("ru-RU")} км</span>
                  </div>
                )}
                {vehicle.volumeCc && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Объём</span>
                    <span>{vehicle.volumeCc} см³</span>
                  </div>
                )}
                {vehicle.powerHp && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Мощность</span>
                    <span>{vehicle.powerHp} л.с.</span>
                  </div>
                )}
                {vehicle.transmission && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">КПП</span>
                    <span>{vehicle.transmission}</span>
                  </div>
                )}
                {vehicle.color && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Цвет</span>
                    <span>{vehicle.color}</span>
                  </div>
                )}
                {vehicle.location && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Город</span>
                    <span>{vehicle.location}</span>
                  </div>
                )}
                {vehicle.source === "CHE168" && (
                  <Badge variant="secondary" className="w-fit">
                    Импорт Che168
                  </Badge>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Расчёт «под ключ»</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleAutoEstimate()}
                  disabled={estimating}
                >
                  {estimating ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Calculator className="mr-1.5 h-4 w-4" />
                  )}
                  Пересчитать
                </Button>
              </CardHeader>
              <CardContent>
                {estimate && estimateResult && estimateInput ? (
                  <CustomsEstimateSnapshot input={estimateInput} result={estimateResult} />
                ) : (
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>Автоматический расчёт по цене и году из объявления.</p>
                    <Button onClick={() => void handleAutoEstimate()} disabled={estimating}>
                      Рассчитать цену
                    </Button>
                  </div>
                )}
                {estimate?.totalWithCar != null && (
                  <p className="mt-4 text-lg font-semibold">
                    Итого: {formatCurrency(estimate.totalWithCar)}
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
          <Select value={selectedDealId} onValueChange={setSelectedDealId}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите сделку" />
            </SelectTrigger>
            <SelectContent>
              {deals.map((deal) => (
                <SelectItem key={deal.id} value={deal.id}>
                  {deal.clientName} · {deal.carBrand} {deal.carModel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end">
            <Button onClick={() => void handleAddToDeal()} disabled={!selectedDealId}>
              Добавить как вариант
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={selectionOpen} onOpenChange={setSelectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить в подборку</DialogTitle>
          </DialogHeader>
          <Select value={selectedSelectionId} onValueChange={setSelectedSelectionId}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите подборку" />
            </SelectTrigger>
            <SelectContent>
              {selections.map((selection) => (
                <SelectItem key={selection.id} value={selection.id}>
                  {selection.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end">
            <Button onClick={() => void handleAddToSelection()} disabled={!selectedSelectionId}>
              Добавить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
