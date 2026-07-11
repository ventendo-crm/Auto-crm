"use client";

import { MediaType } from "@prisma/client";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MediaItem } from "@/lib/types";
import { formatDateTime, formatFileSize } from "@/lib/utils";

interface MediaPreviewDialogProps {
  media?: MediaItem | null;
  items?: MediaItem[];
  currentId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCurrentChange?: (id: string) => void;
}

export function MediaPreviewDialog({
  media,
  items,
  currentId,
  open,
  onOpenChange,
  onCurrentChange,
}: MediaPreviewDialogProps) {
  const gallery = useMemo(() => {
    if (items && items.length > 0) return items;
    if (media) return [media];
    return [];
  }, [items, media]);

  const activeMedia = useMemo(() => {
    if (media) return media;
    if (gallery.length === 0) return null;
    if (currentId) {
      return gallery.find((item) => item.id === currentId) ?? gallery[0];
    }
    return gallery[0];
  }, [gallery, currentId, media]);

  const currentIndex = activeMedia
    ? gallery.findIndex((item) => item.id === activeMedia.id)
    : -1;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < gallery.length - 1;

  const goTo = (offset: number) => {
    if (currentIndex < 0) return;
    const next = gallery[currentIndex + offset];
    if (!next) return;
    onCurrentChange?.(next.id);
  };

  useEffect(() => {
    if (!open || gallery.length <= 1) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (currentIndex < 0) return;

      if (event.key === "ArrowLeft" && currentIndex > 0) {
        event.preventDefault();
        const prev = gallery[currentIndex - 1];
        if (prev) onCurrentChange?.(prev.id);
      }

      if (event.key === "ArrowRight" && currentIndex < gallery.length - 1) {
        event.preventDefault();
        const next = gallery[currentIndex + 1];
        if (next) onCurrentChange?.(next.id);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, currentIndex, gallery, onCurrentChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {activeMedia ? (
        <DialogContent className="z-[100] flex w-[calc(100%-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-4 pr-8">
            <div className="min-w-0">
              <DialogTitle className="truncate text-base">{activeMedia.fileName}</DialogTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatFileSize(activeMedia.size)} · {formatDateTime(activeMedia.uploadedAt)}
                {activeMedia.uploadedBy && ` · ${activeMedia.uploadedBy.name}`}
                {gallery.length > 1 && ` · ${currentIndex + 1} из ${gallery.length}`}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a
                href={`${activeMedia.fileUrl}?download=1`}
                download={activeMedia.fileName}
                target="_blank"
                rel="noreferrer"
              >
                <Download className="h-4 w-4" />
                Скачать
              </a>
            </Button>
          </div>
        </DialogHeader>

        <div className="relative flex w-full min-w-0 items-center justify-center bg-black/5 p-2 sm:p-4">
          {gallery.length > 1 && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 shadow-md sm:left-4"
                disabled={!hasPrev}
                onClick={() => goTo(-1)}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 shadow-md sm:right-4"
                disabled={!hasNext}
                onClick={() => goTo(1)}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}

          <div className="flex w-full min-w-0 max-w-full items-center justify-center px-8 sm:px-12">
            {activeMedia.type === MediaType.PHOTO ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={activeMedia.id}
                src={activeMedia.fileUrl}
                alt={activeMedia.fileName}
                className="mx-auto block h-auto max-h-[70dvh] w-auto max-w-full object-contain"
              />
            ) : (
              <video
                key={activeMedia.id}
                src={activeMedia.fileUrl}
                controls
                autoPlay
                playsInline
                className="mx-auto block h-auto max-h-[70dvh] w-full max-w-full bg-black object-contain"
              >
                <track kind="captions" />
              </video>
            )}
          </div>
        </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
