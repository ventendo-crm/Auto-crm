"use client";

import { MediaType } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import {
  Download,
  Play,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { DealActivityTimeline } from "@/components/deals/deal-activity-timeline";
import { ClientImportProcessView } from "@/components/client/client-import-process-view";
import { DealImportProcess } from "@/components/deals/deal-import-process";
import { DealAdditionalOptions } from "@/components/deals/deal-additional-options";
import { DealComments } from "@/components/deals/deal-comments";
import { DealDocuments } from "@/components/deals/deal-documents";
import { DealLogistics } from "@/components/deals/deal-logistics";
import { SearchProcessLinksPanel } from "@/components/deals/search-process-links";
import { SearchProcessVariantFeedback } from "@/components/client/search-process-variant-feedback";
import { MediaGallery } from "@/components/media/media-gallery";
import { MediaPreviewDialog } from "@/components/media/media-preview-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";
import { STAGE_COLORS } from "@/lib/constants";
import { getMediaDownloadUrl } from "@/lib/media-urls";
import { ClientPortalDeal, MediaItem } from "@/lib/types";
import { DealActivityItem } from "@/lib/services/deal-activity";
import { formatDate, formatFileSize } from "@/lib/utils";

interface PreviewState {
  items: MediaItem[];
  currentId: string;
}

export function ClientDealView() {
  const { user } = useAuth();
  const [deal, setDeal] = useState<ClientPortalDeal | null>(null);
  const [activity, setActivity] = useState<DealActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const refreshDeal = useCallback(async () => {
    try {
      const data = await api.myDeal.get();
      const activityData = await api.deals.activity(data.id);
      setDeal(data);
      setActivity(activityData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обновить данные");
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.myDeal.get();
      const activityData = await api.deals.activity(data.id);
      setDeal(data);
      setActivity(activityData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить карточку");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openPreview = (items: MediaItem[], item: MediaItem) => {
    setPreview({ items, currentId: item.id });
  };

  const previewMedia =
    preview?.items.find((item) => item.id === preview.currentId) ?? preview?.items[0] ?? null;

  if (loading) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-muted-foreground">
        Карточка сделки не найдена
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <Card className="mb-6 border-0 shadow-card">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-xl sm:text-2xl">{deal.clientName}</CardTitle>
            <Badge variant="outline" className={STAGE_COLORS[deal.currentStage]}>
              {deal.stageLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">VIN</p>
            <p className="font-mono text-sm">{deal.vin}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Автомобиль</p>
            <p className="text-sm">
              {deal.carBrand} {deal.carModel} {deal.carYear ? `· ${deal.carYear}` : ""}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Направление</p>
            <p className="text-sm">
              {deal.destinationCity}, {deal.destinationCountry}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Менеджер</p>
            <p className="text-sm">{deal.manager?.name ?? "Не назначен"}</p>
            {deal.manager?.email && (
              <p className="text-xs text-muted-foreground">{deal.manager.email}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ожидаемое прибытие</p>
            <p className="text-sm">{formatDate(deal.expectedArrival)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Фактическое прибытие</p>
            <p className="text-sm">{formatDate(deal.actualArrival)}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="documents" className="space-y-4">
        <div className="-mx-1 overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto w-max min-w-full justify-start gap-0.5 p-1 sm:min-w-0">
            <TabsTrigger value="documents">Документы</TabsTrigger>
            <TabsTrigger value="search-process">Процесс поиска</TabsTrigger>
            <TabsTrigger value="additional-options">Дополнительные опции</TabsTrigger>
            {deal.importProcessEnabled && (
              <TabsTrigger value="import-process">Процесс импорта авто</TabsTrigger>
            )}
            <TabsTrigger value="comments">
              Комментарии и пожелания
              {deal.comments.length > 0 ? ` (${deal.comments.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="media">
              Медиа{deal.media.length > 0 ? ` (${deal.media.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="history">История</TabsTrigger>
            <TabsTrigger value="logistics">Логистика</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="documents">
          <DealDocuments
            dealId={deal.id}
            documents={deal.documents}
            managerId={deal.managerId}
            canUpload
            onUpdated={refreshDeal}
          />
        </TabsContent>

        <TabsContent value="search-process">
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-4 w-4" />
                Процесс поиска
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SearchProcessLinksPanel
                dealId={deal.id}
                links={deal.searchProcessLinks}
              />

              {deal.searchProcess.length === 0 ? (
                <p className="text-sm text-muted-foreground">Варианты поиска пока не добавлены</p>
              ) : (
                deal.searchProcess.map((entry) => (
                  <div key={entry.id} className="rounded-xl border bg-muted/10 p-4">
                    <h3 className="mb-2 text-base font-semibold">Вариант {entry.variantNumber}</h3>
                    {entry.description ? (
                      <p className="mb-3 whitespace-pre-wrap text-base leading-relaxed text-foreground sm:text-lg">
                        {entry.description}
                      </p>
                    ) : (
                      <p className="mb-3 text-base text-muted-foreground">Без описания</p>
                    )}

                    {entry.media.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {entry.media.map((item) => (
                          <ClientMediaThumb
                            key={item.id}
                            item={item}
                            onPreview={() => openPreview(entry.media, item)}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Фото и видео не загружены</p>
                    )}

                    <SearchProcessVariantFeedback
                      dealId={deal.id}
                      entryId={entry.id}
                      variantNumber={entry.variantNumber}
                      initialFeedback={entry.clientFeedback}
                      initialFeedbackAt={entry.clientFeedbackAt}
                      onSaved={refreshDeal}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="additional-options">
          <DealAdditionalOptions dealId={deal.id} onChanged={refreshDeal} />
        </TabsContent>

        {deal.importProcessEnabled && (
          <TabsContent value="import-process">
            <ClientImportProcessView
              entries={deal.importProcess}
              onPreview={openPreview}
            />
          </TabsContent>
        )}

        <TabsContent value="comments">
          <DealComments
            dealId={deal.id}
            managerId={deal.managerId}
            clientUserId={user?.id}
            initialComments={deal.comments}
            onUpdate={refreshDeal}
          />
        </TabsContent>

        <TabsContent value="media">
          <MediaGallery
            dealId={deal.id}
            initialMedia={deal.media}
            canUpload={false}
            canDownload
          />
        </TabsContent>

        <TabsContent value="history">
          <DealActivityTimeline activity={activity} />
        </TabsContent>

        <TabsContent value="logistics">
          <DealLogistics dealId={deal.id} shipment={deal.shipment} />
        </TabsContent>
      </Tabs>

      <MediaPreviewDialog
        media={previewMedia}
        items={preview?.items}
        currentId={preview?.currentId ?? null}
        open={!!preview}
        onOpenChange={(open) => !open && setPreview(null)}
        onCurrentChange={(id) =>
          setPreview((current) => (current ? { ...current, currentId: id } : current))
        }
      />
    </div>
  );
}

function ClientMediaThumb({
  item,
  onPreview,
}: {
  item: MediaItem;
  onPreview: () => void;
}) {
  const isVideo = item.type === MediaType.VIDEO;
  const previewSrc = item.thumbnailUrl ?? item.fileUrl;

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-muted/30 text-left shadow-sm transition-shadow hover:shadow-md">
      <button type="button" onClick={onPreview} className="block w-full">
        <div className="aspect-square w-full overflow-hidden">
          {isVideo ? (
            <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
              <Play className="h-8 w-8 text-white/90" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt={item.fileName}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          )}
        </div>
        <div className="border-t bg-card p-2">
          <p className="truncate text-xs font-medium">{item.fileName}</p>
          <p className="text-[10px] text-muted-foreground">{formatFileSize(item.size)}</p>
        </div>
      </button>
      <a
        href={getMediaDownloadUrl(item.id)}
        download={item.fileName}
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-background/90 text-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100"
        onClick={(event) => event.stopPropagation()}
        title="Скачать"
      >
        <Download className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
