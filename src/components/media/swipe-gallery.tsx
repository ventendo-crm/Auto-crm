"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ZoomableImage } from "@/components/media/zoomable-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function SwipeGallery({
  images,
  labels,
}: {
  images: string[];
  labels: string[];
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    setIndex(0);
    scrollerRef.current?.scrollTo({ left: 0 });
  }, [images]);

  const goTo = (next: number) => {
    const clamped = Math.min(images.length - 1, Math.max(0, next));
    setIndex(clamped);
    const scroller = scrollerRef.current;
    if (scroller) {
      scroller.scrollTo({ left: clamped * scroller.clientWidth, behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (!lightbox || images.length <= 1) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(index - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(index + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox, images.length, index]);

  if (images.length === 0) return null;

  const onScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.clientWidth === 0) return;
    const next = Math.round(scroller.scrollLeft / scroller.clientWidth);
    setIndex(Math.min(images.length - 1, Math.max(0, next)));
  };

  return (
    <>
      <div className="space-y-2">
        <div className="overflow-hidden rounded-lg">
          <div
            ref={scrollerRef}
            onScroll={onScroll}
            className="flex snap-x snap-mandatory touch-pan-x overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {images.map((url, imageIndex) => (
              <button
                key={`${url}-${imageIndex}`}
                type="button"
                className="min-w-full shrink-0 basis-full snap-center overflow-hidden"
                onClick={() => {
                  setIndex(imageIndex);
                  setLightbox(true);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={labels[imageIndex] ?? ""}
                  className="aspect-[4/3] w-full object-cover"
                  draggable={false}
                />
              </button>
            ))}
          </div>
        </div>
        {images.length > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            {images.map((_, imageIndex) => (
              <button
                key={imageIndex}
                type="button"
                aria-label={`Фото ${imageIndex + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  imageIndex === index ? "w-5 bg-foreground" : "w-1.5 bg-muted-foreground/40",
                )}
                onClick={() => goTo(imageIndex)}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={lightbox} onOpenChange={setLightbox}>
        {lightbox ? (
          <DialogContent className="z-[100] flex h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[96dvh] sm:max-w-6xl sm:rounded-xl">
            <DialogHeader className="shrink-0 border-b px-3 py-2 sm:px-4">
              <DialogTitle className="pr-8 text-sm">
                {labels[index] ?? "Фото"}
                {images.length > 1 ? ` · ${index + 1} из ${images.length}` : ""}
              </DialogTitle>
            </DialogHeader>
            <div className="relative flex min-h-0 w-full flex-1 items-center justify-center bg-black">
              {images.length > 1 && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute left-1 top-1/2 z-10 -translate-y-1/2 bg-background/80 shadow-md sm:left-3"
                    disabled={index <= 0}
                    onClick={() => goTo(index - 1)}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-1 top-1/2 z-10 -translate-y-1/2 bg-background/80 shadow-md sm:right-3"
                    disabled={index >= images.length - 1}
                    onClick={() => goTo(index + 1)}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}
              <div className="flex h-full w-full min-w-0 items-center justify-center">
                <ZoomableImage
                  key={images[index]}
                  src={images[index]}
                  alt={labels[index] ?? ""}
                  onSwipe={(direction) => {
                    if (direction === "next") goTo(index + 1);
                    else goTo(index - 1);
                  }}
                />
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
