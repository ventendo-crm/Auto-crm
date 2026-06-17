"use client";

import { MediaType } from "@prisma/client";
import { Play, Ship } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ClientImportProcessViewProps {
  entries: {
    id: string;
    description: string;
    stageNumber: number;
    media: MediaItem[];
  }[];
  onPreview: (items: MediaItem[], item: MediaItem) => void;
}

export function ClientImportProcessView({ entries, onPreview }: ClientImportProcessViewProps) {
  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Ship className="h-4 w-4" />
          Процесс импорта авто
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Этапы импорта пока не добавлены</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="rounded-xl border bg-muted/10 p-4">
              <h3 className="mb-2 text-base font-semibold">Этап {entry.stageNumber}</h3>
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
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onPreview(entry.media, item)}
                      className={cn(
                        "group overflow-hidden rounded-lg border bg-muted/30 text-left shadow-sm transition-shadow hover:shadow-md",
                      )}
                    >
                      <div className="aspect-square w-full overflow-hidden">
                        {item.type === MediaType.VIDEO ? (
                          <video
                            src={item.fileUrl}
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.thumbnailUrl ?? item.fileUrl}
                            alt={item.fileName}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        )}
                      </div>
                      {item.type === MediaType.VIDEO && (
                        <div className="flex items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground">
                          <Play className="h-3 w-3" />
                          Видео
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Фото и видео не загружены</p>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
