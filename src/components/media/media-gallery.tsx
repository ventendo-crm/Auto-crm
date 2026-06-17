"use client";

import { MediaType } from "@prisma/client";
import { Play, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MediaPreviewDialog } from "@/components/media/media-preview-dialog";
import { MediaUploadZone } from "@/components/media/media-upload-zone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import { MediaItem } from "@/lib/types";
import { cn, formatFileSize } from "@/lib/utils";

interface MediaGalleryProps {
  dealId: string;
  initialMedia: MediaItem[];
  canUpload?: boolean;
  onUpdate?: () => void;
}

export function MediaGallery({
  dealId,
  initialMedia,
  canUpload = true,
  onUpdate,
}: MediaGalleryProps) {
  const [media, setMedia] = useState(initialMedia);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [filter, setFilter] = useState<"all" | "photo" | "video">("all");

  useEffect(() => {
    setMedia(initialMedia);
  }, [initialMedia]);

  const photos = media.filter((m) => m.type === MediaType.PHOTO);
  const videos = media.filter((m) => m.type === MediaType.VIDEO);

  const filtered =
    filter === "photo" ? photos : filter === "video" ? videos : media;

  const handleUpload = async (files: File[]) => {
    const result = await api.media.upload(dealId, files);
    const uploaded = Array.isArray(result) ? result : [result];
    setMedia((prev) => [...uploaded, ...prev]);
    onUpdate?.();
    toast.success(`Загружено файлов: ${uploaded.length}`);
  };

  const handleDelete = async (item: MediaItem) => {
    if (!confirm(`Удалить «${item.fileName}»?`)) return;
    try {
      await api.media.delete(item.id);
      setMedia((prev) => prev.filter((m) => m.id !== item.id));
      onUpdate?.();
      toast.success("Файл удалён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

  return (
    <div className="space-y-4">
      {canUpload && <MediaUploadZone onUpload={handleUpload} />}

      <Card className="border-0 shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Галерея</CardTitle>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs">
                Все ({media.length})
              </TabsTrigger>
              <TabsTrigger value="photo" className="text-xs">
                Фото ({photos.length})
              </TabsTrigger>
              <TabsTrigger value="video" className="text-xs">
                Видео ({videos.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              {canUpload ? "Загрузите фото или видео" : "Медиафайлов нет"}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((item) => (
                <MediaGalleryItem
                  key={item.id}
                  item={item}
                  canDelete={canUpload}
                  onPreview={() => setPreview(item)}
                  onDelete={() => handleDelete(item)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <MediaPreviewDialog
        media={preview}
        open={!!preview}
        onOpenChange={(open) => !open && setPreview(null)}
      />
    </div>
  );
}

function MediaGalleryItem({
  item,
  canDelete,
  onPreview,
  onDelete,
}: {
  item: MediaItem;
  canDelete: boolean;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const isVideo = item.type === MediaType.VIDEO;
  const previewSrc = item.thumbnailUrl ?? item.fileUrl;

  return (
    <div className="group relative overflow-hidden rounded-xl border bg-muted/30 shadow-sm">
      <button
        type="button"
        onClick={onPreview}
        className="block aspect-square w-full overflow-hidden"
      >
        {isVideo ? (
          <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
            <Play className="h-10 w-10 text-white/90" />
            <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
              Видео
            </span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewSrc}
            alt={item.fileName}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        )}
      </button>

      <div className="border-t bg-card p-2">
        <p className="truncate text-xs font-medium">{item.fileName}</p>
        <p className="text-[10px] text-muted-foreground">{formatFileSize(item.size)}</p>
      </div>

      {canDelete && (
        <Button
          variant="destructive"
          size="icon"
          className={cn(
            "absolute right-2 top-2 h-7 w-7 opacity-0 shadow-md transition-opacity group-hover:opacity-100",
          )}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
