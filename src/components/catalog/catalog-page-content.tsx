"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderPlus, Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError } from "@/lib/api-client";
import type { CatalogSectionItem, CatalogVehicleListItem } from "@/lib/types/catalog";
import { cn, formatCurrency } from "@/lib/utils";

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

function VehicleCard({ vehicle }: { vehicle: CatalogVehicleListItem }) {
  const image = vehicle.photos[0]?.fileUrl ?? vehicle.coverImageUrl ?? vehicle.galleryUrls[0] ?? null;
  const total = vehicle.estimate?.totalWithCar ?? null;
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
          <p className="text-base font-semibold">
            {total != null ? formatCurrency(total) : "Нет расчёта"}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function CatalogPageContent() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<CatalogVehicleListItem[]>([]);
  const [sections, setSections] = useState<CatalogSectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionId, setSectionId] = useState<string>("all");
  const [query, setQuery] = useState("");
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

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (sectionId !== "all") params.set("sectionId", sectionId);
    return params.toString();
  }, [query, sectionId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [vehiclesData, sectionsData] = await Promise.all([
        apiGet<{ items: CatalogVehicleListItem[] }>(`/api/catalog/vehicles?${queryString}`),
        apiGet<CatalogSectionItem[]>("/api/catalog/sections"),
      ]);
      setVehicles(vehiclesData.items);
      setSections(sectionsData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить каталог");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  return (
    <>
      <Header title="Каталог" subtitle="Новые авто: фото, описание, цена «под ключ» и ссылка клиенту" />

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6 lg:flex-row">
        <aside className="w-full shrink-0 space-y-2 lg:w-56">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Разделы</p>
          <button
            type="button"
            onClick={() => setSectionId("all")}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm",
              sectionId === "all" ? "bg-brand-muted text-brand" : "hover:bg-muted",
            )}
          >
            Все
            <span className="text-xs text-muted-foreground">{vehicles.length}</span>
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
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Поиск по названию..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} />
              Обновить
            </Button>
            <Button
              size="sm"
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
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {vehicles.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>
          )}
        </div>
      </div>

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
              Расчёт «под ключ» — тот же калькулятор, что в Подборе. Он откроется в карточке после создания.
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
