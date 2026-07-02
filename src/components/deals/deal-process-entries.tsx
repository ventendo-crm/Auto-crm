"use client";

import { MediaType } from "@prisma/client";
import { Eye, ImagePlus, Loader2, Play, Plus, Trash2 } from "lucide-react";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MediaPreviewDialog } from "@/components/media/media-preview-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_PROCESS_ENTRY_MEDIA } from "@/lib/constants";
import { api } from "@/lib/api-client";
import { MediaItem } from "@/lib/types";
import { cn, formatDateTime, formatFileSize } from "@/lib/utils";

const MAX_MEDIA = MAX_PROCESS_ENTRY_MEDIA;
const MEDIA_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

export interface ProcessEntryItem {
  id: string;
  description: string;
  media: MediaItem[];
  clientFeedback?: string | null;
  clientFeedbackAt?: string | null;
}

export interface ProcessEntriesApi {
  list: (dealId: string) => Promise<ProcessEntryItem[]>;
  create: (dealId: string) => Promise<ProcessEntryItem>;
  update: (dealId: string, entryId: string, description: string) => Promise<ProcessEntryItem>;
  delete: (dealId: string, entryId: string) => Promise<void>;
  uploadMedia: (dealId: string, entryId: string, files: File[]) => Promise<MediaItem | MediaItem[]>;
}

interface DealProcessEntriesProps {
  dealId: string;
  canEdit?: boolean;
  onChanged?: () => void;
  title: string;
  subtitle: string;
  entryLabel: string;
  emptyText: string;
  addButtonText: string;
  addSuccessText: string;
  addErrorText: string;
  deleteConfirmText: string;
  deleteSuccessText: string;
  loadErrorText: string;
  mediaPerEntryLabel: string;
  descriptionPlaceholder: string;
  entriesApi: ProcessEntriesApi;
  headerExtra?: ReactNode;
  showClientFeedback?: boolean;
  autoCreateFirst?: boolean;
  hideMediaCaptions?: boolean;
}

interface PreviewState {
  items: MediaItem[];
  currentId: string;
}

export function DealProcessEntries({
  dealId,
  canEdit = false,
  onChanged,
  title,
  subtitle,
  entryLabel,
  emptyText,
  addButtonText,
  addSuccessText,
  addErrorText,
  deleteConfirmText,
  deleteSuccessText,
  loadErrorText,
  mediaPerEntryLabel,
  descriptionPlaceholder,
  entriesApi,
  headerExtra,
  showClientFeedback = false,
  autoCreateFirst = true,
  hideMediaCaptions = false,
}: DealProcessEntriesProps) {
  const [entries, setEntries] = useState<ProcessEntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await entriesApi.list(dealId);
      if (data.length === 0 && canEdit && autoCreateFirst) {
        const created = await entriesApi.create(dealId);
        setEntries([created]);
      } else {
        setEntries(data);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : loadErrorText);
    } finally {
      setLoading(false);
    }
  }, [autoCreateFirst, canEdit, dealId, entriesApi, loadErrorText]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAddEntry = async () => {
    setAdding(true);
    try {
      const entry = await entriesApi.create(dealId);
      setEntries((prev) => [...prev, entry]);
      onChanged?.();
      toast.success(addSuccessText);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : addErrorText);
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateEntry = (updated: ProcessEntryItem) => {
    setEntries((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    setPreview((current) => {
      if (!current) return current;
      if (!updated.media.some((item) => item.id === current.currentId)) {
        return null;
      }
      return { items: updated.media, currentId: current.currentId };
    });
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm(deleteConfirmText)) return;

    try {
      await entriesApi.delete(dealId, entryId);
      setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
      setPreview(null);
      onChanged?.();
      toast.success(deleteSuccessText);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить");
    }
  };

  const openPreview = (items: MediaItem[], item: MediaItem) => {
    setPreview({ items, currentId: item.id });
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Загрузка...
      </div>
    );
  }

  const previewMedia =
    preview?.items.find((item) => item.id === preview.currentId) ?? preview?.items[0] ?? null;

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {headerExtra}

          {entries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              {emptyText}
              {canEdit && (
                <div className="mt-4">
                  <Button type="button" variant="brand" onClick={handleAddEntry} disabled={adding}>
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {addButtonText}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            entries.map((entry, index) => (
              <ProcessEntryCard
                key={entry.id}
                dealId={dealId}
                entry={entry}
                entryNumber={index + 1}
                entryLabel={entryLabel}
                canEdit={canEdit}
                canDelete={canEdit && entries.length > 1}
                descriptionPlaceholder={descriptionPlaceholder}
                mediaPerEntryLabel={mediaPerEntryLabel}
                showClientFeedback={showClientFeedback}
                hideMediaCaptions={hideMediaCaptions}
                entriesApi={entriesApi}
                onUpdated={handleUpdateEntry}
                onChanged={onChanged}
                onDeleted={() => void handleDeleteEntry(entry.id)}
                onPreview={openPreview}
              />
            ))
          )}

          {canEdit && entries.length > 0 && (
            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed"
              onClick={handleAddEntry}
              disabled={adding}
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {addButtonText}
            </Button>
          )}
        </CardContent>
      </Card>

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

function ProcessEntryCard({
  dealId,
  entry,
  entryNumber,
  entryLabel,
  canEdit,
  canDelete,
  descriptionPlaceholder,
  mediaPerEntryLabel,
  showClientFeedback,
  hideMediaCaptions,
  entriesApi,
  onUpdated,
  onChanged,
  onDeleted,
  onPreview,
}: {
  dealId: string;
  entry: ProcessEntryItem;
  entryNumber: number;
  entryLabel: string;
  canEdit: boolean;
  canDelete: boolean;
  descriptionPlaceholder: string;
  mediaPerEntryLabel: string;
  showClientFeedback: boolean;
  hideMediaCaptions: boolean;
  entriesApi: ProcessEntriesApi;
  onUpdated: (entry: ProcessEntryItem) => void;
  onChanged?: () => void;
  onDeleted: () => void;
  onPreview: (items: MediaItem[], item: MediaItem) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState(entry.description);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setDescription(entry.description);
  }, [entry.description]);

  const saveDescription = async () => {
    if (description === entry.description) return;

    setSaving(true);
    try {
      const updated = await entriesApi.update(dealId, entry.id, description);
      onUpdated(updated);
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить описание");
      setDescription(entry.description);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    const slotsLeft = MAX_MEDIA - entry.media.length;
    if (slotsLeft <= 0) {
      toast.error(`Достигнут лимит: ${MAX_MEDIA} ${mediaPerEntryLabel}`);
      return;
    }

    if (list.length > slotsLeft) {
      toast.error(`Можно загрузить ещё ${slotsLeft} файл(ов)`);
      return;
    }

    setUploading(true);
    try {
      const result = await entriesApi.uploadMedia(dealId, entry.id, list);
      const uploaded = Array.isArray(result) ? result : [result];
      onUpdated({
        ...entry,
        media: [...entry.media, ...uploaded],
      });
      onChanged?.();
      toast.success(`Загружено файлов: ${uploaded.length}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteMedia = async (item: MediaItem) => {
    if (!confirm(`Удалить «${item.fileName}»?`)) return;

    try {
      await api.media.delete(item.id);
      onUpdated({
        ...entry,
        media: entry.media.filter((media) => media.id !== item.id),
      });
      onChanged?.();
      toast.success("Файл удалён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

  const slotsLeft = MAX_MEDIA - entry.media.length;

  return (
    <div className="rounded-xl border bg-muted/10 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          {entryLabel} {entryNumber}
        </h3>
        {canDelete && (
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onDeleted}>
            <Trash2 className="h-4 w-4" />
            Удалить
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`entry-desc-${entry.id}`} className="text-xs">
            Описание
          </Label>
          <Textarea
            id={`entry-desc-${entry.id}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => void saveDescription()}
            placeholder={descriptionPlaceholder}
            disabled={!canEdit || saving}
            rows={2}
            className="min-h-[60px] resize-y text-sm"
          />
          {saving && (
            <p className="text-xs text-muted-foreground">
              <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
              Сохранение...
            </p>
          )}
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={MEDIA_ACCEPT}
              className="hidden"
              disabled={uploading || slotsLeft <= 0}
              onChange={(e) => {
                if (e.target.files?.length) void handleUpload(e.target.files);
              }}
            />
            <Button
              type="button"
              variant="brand"
              size="sm"
              disabled={uploading || slotsLeft <= 0}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              Загрузить фото / видео
            </Button>
            <span className="text-xs text-muted-foreground">
              {entry.media.length} / {MAX_MEDIA}
              {slotsLeft <= 0 && " · лимит достигнут"}
            </span>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Галерея</Label>

          {entry.media.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {entry.media.map((item) => (
                <ProcessMediaTile
                  key={item.id}
                  item={item}
                  canDelete={canEdit}
                  hideCaption={hideMediaCaptions}
                  onPreview={() => onPreview(entry.media, item)}
                  onDelete={() => void handleDeleteMedia(item)}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-28 items-center justify-center rounded-lg border border-dashed bg-background/50 text-sm text-muted-foreground">
              {canEdit ? "Загрузите фото или видео" : "Файлы не добавлены"}
            </div>
          )}
        </div>

        {showClientFeedback && entry.clientFeedback && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
            <Label className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
              Обратная связь клиента
            </Label>
            <p className="mt-2 whitespace-pre-wrap text-sm">{entry.clientFeedback}</p>
            {entry.clientFeedbackAt && (
              <p className="mt-2 text-xs text-muted-foreground">
                {formatDateTime(entry.clientFeedbackAt)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProcessMediaTile({
  item,
  canDelete,
  hideCaption = false,
  onPreview,
  onDelete,
}: {
  item: MediaItem;
  canDelete: boolean;
  hideCaption?: boolean;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const isVideo = item.type === MediaType.VIDEO;
  const previewSrc = item.thumbnailUrl ?? item.fileUrl;

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card shadow-sm">
      <div
        role="button"
        tabIndex={0}
        onClick={onPreview}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onPreview();
          }
        }}
        className="relative block w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Открыть предпросмотр"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {isVideo && !item.thumbnailUrl ? (
            <video
              src={item.fileUrl}
              muted
              playsInline
              preload="metadata"
              className="pointer-events-none h-full w-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt={item.fileName}
              className="pointer-events-none h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          )}

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
            {isVideo && (
              <Play className="h-7 w-7 text-white drop-shadow-md transition-opacity group-hover:opacity-0" />
            )}
            <span className="flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Eye className="h-3 w-3" />
              Смотреть
            </span>
          </div>

          {isVideo && (
            <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
              Видео
            </span>
          )}
        </div>

        {!hideCaption && (
          <div className="border-t px-2 py-1.5">
            <p className="truncate text-[11px] font-medium">{item.fileName}</p>
            <p className="text-[10px] text-muted-foreground">{formatFileSize(item.size)}</p>
          </div>
        )}
      </div>

      {canDelete && (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className={cn(
            "absolute right-1 top-1 z-10 h-6 w-6 opacity-0 shadow-md transition-opacity group-hover:opacity-100",
          )}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
