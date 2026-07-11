"use client";

import { MediaType } from "@prisma/client";
import { Flag, ImagePlus, Loader2, MapPin, Trash2, Truck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CarCarrierMapMode,
  CarCarrierTrackingMap,
} from "@/components/deals/car-carrier-tracking-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_TRACKING_POINT_MEDIA } from "@/lib/constants";
import { api } from "@/lib/api-client";
import { CarCarrierDestination, CarCarrierTrackingPoint } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

interface CarCarrierTrackingProps {
  dealId: string;
  canEdit?: boolean;
  initialPoints?: CarCarrierTrackingPoint[];
  initialDestination?: CarCarrierDestination | null;
}

export function CarCarrierTracking({
  dealId,
  canEdit = false,
  initialPoints,
  initialDestination,
}: CarCarrierTrackingProps) {
  const [points, setPoints] = useState<CarCarrierTrackingPoint[]>(initialPoints ?? []);
  const [destination, setDestination] = useState<CarCarrierDestination | null>(
    initialDestination ?? null,
  );
  const [loading, setLoading] = useState(initialPoints === undefined);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<CarCarrierMapMode>(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedPoint = points.find((point) => point.id === selectedPointId) ?? null;
  const hasInitialData = initialPoints !== undefined;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.carCarrierTracking.get(dealId);
      setPoints(data.points);
      setDestination(data.destination);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить маршрут");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    if (!hasInitialData) {
      void load();
    }
  }, [hasInitialData, load]);

  const setMode = (mode: CarCarrierMapMode) => {
    setAddMode(mode);
    if (mode) {
      setSelectedPointId(null);
    }
  };

  const handleMapClick = async (latitude: number, longitude: number) => {
    if (!canEdit || !addMode) return;

    setSaving(true);
    try {
      if (addMode === "destination") {
        const nextDestination = await api.carCarrierTracking.setDestination(dealId, {
          latitude,
          longitude,
          title: destination?.title || "Точка назначения",
        });
        setDestination(nextDestination);
        setAddMode(false);
        toast.success("Точка назначения установлена");
        return;
      }

      const point = await api.carCarrierTracking.create(dealId, {
        latitude,
        longitude,
        title: `Точка ${points.length + 1}`,
      });
      setPoints((current) => [...current, point]);
      setSelectedPointId(point.id);
      setAddMode(false);
      toast.success("Точка добавлена на карту");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить точку");
    } finally {
      setSaving(false);
    }
  };

  const updateSelectedPoint = async (
    patch: Partial<Pick<CarCarrierTrackingPoint, "title" | "description" | "recordedAt">>,
  ) => {
    if (!selectedPoint || !canEdit) return;

    setSaving(true);
    try {
      const updated = await api.carCarrierTracking.update(dealId, selectedPoint.id, patch);
      setPoints((current) =>
        current.map((point) => (point.id === updated.id ? updated : point)),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedPoint = async () => {
    if (!selectedPoint || !canEdit) return;
    if (!window.confirm("Удалить эту точку маршрута?")) return;

    setSaving(true);
    try {
      await api.carCarrierTracking.delete(dealId, selectedPoint.id);
      setPoints((current) => current.filter((point) => point.id !== selectedPoint.id));
      setSelectedPointId(null);
      toast.success("Точка удалена");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить точку");
    } finally {
      setSaving(false);
    }
  };

  const updateDestinationTitle = async (title: string) => {
    if (!destination || !canEdit) return;

    setSaving(true);
    try {
      const updated = await api.carCarrierTracking.updateDestinationTitle(dealId, title);
      setDestination(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const deleteDestination = async () => {
    if (!destination || !canEdit) return;
    if (!window.confirm("Удалить точку назначения?")) return;

    setSaving(true);
    try {
      await api.carCarrierTracking.clearDestination(dealId);
      setDestination(null);
      toast.success("Точка назначения удалена");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить");
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!selectedPoint || !canEdit || !files?.length) return;

    setUploading(true);
    try {
      const uploaded = await api.carCarrierTracking.uploadMedia(
        dealId,
        selectedPoint.id,
        Array.from(files),
      );
      const items = Array.isArray(uploaded) ? uploaded : [uploaded];
      setPoints((current) =>
        current.map((point) =>
          point.id === selectedPoint.id
            ? { ...point, media: [...point.media, ...items] }
            : point,
        ),
      );
      toast.success("Фото загружены");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-4 w-4" />
          Отслеживание автовоза
        </CardTitle>
        <CardDescription>
          {canEdit
            ? "Отмечайте точки маршрута и финальное назначение на карте. Точки соединяются красной линией."
            : "Маршрут автовоза с отметками, финальной точкой назначения и фотографиями."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex h-[min(50vh,420px)] items-center justify-center rounded-lg border bg-muted/20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={addMode === "tracking" ? "brand" : "outline"}
                  onClick={() => setMode(addMode === "tracking" ? false : "tracking")}
                  disabled={saving}
                >
                  <MapPin className="h-4 w-4" />
                  {addMode === "tracking" ? "Нажмите на карту..." : "Добавить точку"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={addMode === "destination" ? "brand" : "outline"}
                  onClick={() => setMode(addMode === "destination" ? false : "destination")}
                  disabled={saving}
                >
                  <Flag className="h-4 w-4" />
                  {addMode === "destination"
                    ? "Нажмите на карту..."
                    : destination
                      ? "Переместить назначение"
                      : "Точка назначения"}
                </Button>
                {addMode && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setMode(false)}>
                    Отмена
                  </Button>
                )}
              </div>
            )}

            <CarCarrierTrackingMap
              points={points}
              destination={destination}
              selectedPointId={selectedPointId}
              canAddPoints={canEdit}
              addMode={addMode}
              onMapClick={(lat, lng) => void handleMapClick(lat, lng)}
              onPointSelect={setSelectedPointId}
            />

            {destination && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                      Точка назначения
                    </p>
                    {canEdit ? (
                      <Input
                        className="mt-2 h-8"
                        value={destination.title}
                        onChange={(event) =>
                          setDestination({ ...destination, title: event.target.value })
                        }
                        onBlur={() => void updateDestinationTitle(destination.title)}
                      />
                    ) : (
                      <p className="mt-1 text-sm font-medium">{destination.title}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {destination.latitude.toFixed(5)}, {destination.longitude.toFixed(5)}
                    </p>
                  </div>
                  {canEdit && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void deleteDestination()}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {points.length === 0 && !destination && (
              <p className="text-sm text-muted-foreground">
                {canEdit
                  ? "Маршрут пока не отмечен. Добавьте точки маршрута и финальное назначение на карте."
                  : "Маршрут автовоза пока не добавлен."}
              </p>
            )}

            {points.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {points.map((point, index) => (
                  <button
                    key={point.id}
                    type="button"
                    onClick={() => {
                      setSelectedPointId(point.id);
                      setAddMode(false);
                    }}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      selectedPointId === point.id
                        ? "border-brand bg-brand-muted/40"
                        : "bg-muted/20 hover:bg-muted/40",
                    )}
                  >
                    <p className="text-sm font-medium">
                      {point.title.trim() || `Точка ${index + 1}`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(point.recordedAt)}
                      {point.media.length > 0 ? ` · ${point.media.length} фото` : ""}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {selectedPoint && (
              <div className="space-y-4 rounded-xl border bg-muted/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-medium">Детали точки</h4>
                    <p className="text-xs text-muted-foreground">
                      {selectedPoint.latitude.toFixed(5)}, {selectedPoint.longitude.toFixed(5)}
                    </p>
                  </div>
                  {canEdit && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void deleteSelectedPoint()}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {canEdit ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="tracking-title">Название</Label>
                      <Input
                        id="tracking-title"
                        value={selectedPoint.title}
                        onChange={(event) =>
                          setPoints((current) =>
                            current.map((point) =>
                              point.id === selectedPoint.id
                                ? { ...point, title: event.target.value }
                                : point,
                            ),
                          )
                        }
                        onBlur={() =>
                          void updateSelectedPoint({ title: selectedPoint.title })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tracking-date">Дата</Label>
                      <Input
                        id="tracking-date"
                        type="date"
                        value={selectedPoint.recordedAt.split("T")[0]}
                        onChange={(event) => {
                          const recordedAt = event.target.value
                            ? new Date(event.target.value).toISOString()
                            : selectedPoint.recordedAt;
                          setPoints((current) =>
                            current.map((point) =>
                              point.id === selectedPoint.id ? { ...point, recordedAt } : point,
                            ),
                          );
                          void updateSelectedPoint({ recordedAt });
                        }}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="tracking-description">Комментарий</Label>
                      <Textarea
                        id="tracking-description"
                        rows={2}
                        value={selectedPoint.description}
                        placeholder="Например: автовоз на границе, стоянка..."
                        onChange={(event) =>
                          setPoints((current) =>
                            current.map((point) =>
                              point.id === selectedPoint.id
                                ? { ...point, description: event.target.value }
                                : point,
                            ),
                          )
                        }
                        onBlur={() =>
                          void updateSelectedPoint({ description: selectedPoint.description })
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Дата: </span>
                      {formatDate(selectedPoint.recordedAt)}
                    </p>
                    {selectedPoint.description && (
                      <p className="whitespace-pre-wrap">{selectedPoint.description}</p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Фотографии</p>
                    {canEdit && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          multiple
                          className="hidden"
                          onChange={(event) => void handleUpload(event.target.files)}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={
                            uploading ||
                            selectedPoint.media.length >= MAX_TRACKING_POINT_MEDIA
                          }
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ImagePlus className="h-4 w-4" />
                          )}
                          Добавить фото
                        </Button>
                      </>
                    )}
                  </div>

                  {selectedPoint.media.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                      {selectedPoint.media.map((item) => (
                        <a
                          key={item.id}
                          href={item.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="overflow-hidden rounded-lg border bg-muted/30"
                        >
                          {item.type === MediaType.VIDEO ? (
                            <video
                              src={item.fileUrl}
                              className="aspect-square w-full object-cover"
                              controls
                              preload="metadata"
                            />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.thumbnailUrl ?? item.fileUrl}
                              alt={item.fileName}
                              className="aspect-square w-full object-cover"
                            />
                          )}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Фото не прикреплены</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
