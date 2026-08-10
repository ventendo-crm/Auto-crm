"use client";

import { MediaType } from "@prisma/client";
import { cn } from "@/lib/utils";

type MediaThumbItem = {
  type: MediaType;
  fileUrl: string;
  thumbnailUrl?: string | null;
  fileName: string;
};

interface MediaThumbProps {
  item: MediaThumbItem;
  className?: string;
  alt?: string;
}

/** URL с меткой времени, чтобы браузер показал первый кадр, а не чёрный экран. */
export function mediaVideoPreviewSrc(fileUrl: string): string {
  const base = fileUrl.split("#")[0] ?? fileUrl;
  return `${base}#t=0.001`;
}

/**
 * Превью в сетке: фото — картинка, видео — первый кадр через &lt;video&gt;.
 * Для видео не используем thumbnailUrl как &lt;img&gt;: часто это тот же файл видео.
 */
export function MediaThumb({ item, className, alt }: MediaThumbProps) {
  if (item.type === MediaType.VIDEO) {
    return (
      <video
        src={mediaVideoPreviewSrc(item.fileUrl)}
        muted
        playsInline
        preload="metadata"
        className={cn("pointer-events-none h-full w-full bg-slate-900 object-cover", className)}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.thumbnailUrl ?? item.fileUrl}
      alt={alt ?? item.fileName}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
