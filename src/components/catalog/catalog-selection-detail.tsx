"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Link2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiRequestError } from "@/lib/api-client";
import type { CatalogSelectionListItem, CatalogShareLink } from "@/lib/types/catalog";
import { formatCurrency } from "@/lib/utils";

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include" });
  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new ApiRequestError(json.error ?? "Ошибка запроса", response.status);
  }
  return json.data as T;
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new ApiRequestError(json.error ?? "Ошибка запроса", response.status);
  }
  return json.data as T;
}

export function CatalogSelectionDetailView({ selectionId }: { selectionId: string }) {
  const [selection, setSelection] = useState<CatalogSelectionListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareLabel, setShareLabel] = useState("");
  const [creatingLink, setCreatingLink] = useState(false);
  const [lastLink, setLastLink] = useState<CatalogShareLink | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<CatalogSelectionListItem>(`/api/catalog/selections/${selectionId}`);
      setSelection(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить подборку");
    } finally {
      setLoading(false);
    }
  }, [selectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreateLink() {
    setCreatingLink(true);
    try {
      const link = await apiPost<CatalogShareLink>(`/api/catalog/selections/${selectionId}/share-tokens`, {
        label: shareLabel.trim() || undefined,
        expiresInDays: 30,
      });
      setLastLink(link);
      setShareLabel("");
      toast.success("Ссылка создана");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось создать ссылку");
    } finally {
      setCreatingLink(false);
    }
  }

  async function handleRevoke(tokenId: string) {
    try {
      await fetch(`/api/catalog/selections/${selectionId}/share-tokens/${tokenId}`, {
        method: "DELETE",
        credentials: "include",
      });
      toast.success("Ссылка отозвана");
      await load();
    } catch {
      toast.error("Не удалось отозвать ссылку");
    }
  }

  async function handleRemoveItem(itemId: string) {
    try {
      await fetch(`/api/catalog/selections/${selectionId}/items/${itemId}`, {
        method: "DELETE",
        credentials: "include",
      });
      toast.success("Удалено из подборки");
      await load();
    } catch {
      toast.error("Не удалось удалить");
    }
  }

  if (loading || !selection) {
    return (
      <>
        <Header title="Подборка" subtitle="Загрузка..." />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title={selection.title}
        subtitle={`${selection.items.length} автомобилей`}
      />

      <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
        <Button variant="outline" size="sm" asChild>
          <Link href="/catalog">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            К каталогу
          </Link>
        </Button>
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-end gap-2">
              <Input
                placeholder="Метка ссылки (необязательно)"
                value={shareLabel}
                onChange={(e) => setShareLabel(e.target.value)}
                className="max-w-xs"
              />
              <Button onClick={() => void handleCreateLink()} disabled={creatingLink}>
                {creatingLink ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="mr-2 h-4 w-4" />
                )}
                Ссылка для клиента
              </Button>
            </div>
            {lastLink && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3 text-sm">
                <code className="break-all">{lastLink.url}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(
                      lastLink.url.startsWith("http")
                        ? lastLink.url
                        : `${window.location.origin}${lastLink.url}`,
                    );
                    toast.success("Скопировано");
                  }}
                >
                  <Copy className="mr-1.5 h-4 w-4" />
                  Копировать
                </Button>
              </div>
            )}
            {selection.shareTokens.length > 0 && (
              <div className="space-y-2">
                {selection.shareTokens.map((token) => (
                  <div
                    key={token.id}
                    className="flex items-center justify-between gap-2 rounded border p-2 text-sm"
                  >
                    <div>
                      <p>{token.label || "Без метки"}</p>
                      <p className="text-xs text-muted-foreground">
                        Просмотров: {token.viewCount}
                        {token.active ? "" : " · отозвана"}
                      </p>
                    </div>
                    {token.active && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleRevoke(token.id)}
                      >
                        Отозвать
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {selection.items.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <div className="flex gap-4 p-4">
                {item.vehicle.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.vehicle.coverImageUrl}
                    alt=""
                    className="h-24 w-32 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-32 shrink-0 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                    Нет фото
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <Link
                    href={`/catalog/${item.vehicle.id}`}
                    className="font-semibold hover:text-brand"
                  >
                    {item.vehicle.titleRu}
                  </Link>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {item.vehicle.priceCny != null && (
                      <span>{item.vehicle.priceCny.toLocaleString("ru-RU")} ¥</span>
                    )}
                    {item.vehicle.estimateTotal != null && (
                      <Badge variant="secondary">
                        ≈ {formatCurrency(item.vehicle.estimateTotal)}
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-destructive"
                    onClick={() => void handleRemoveItem(item.id)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Убрать
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
