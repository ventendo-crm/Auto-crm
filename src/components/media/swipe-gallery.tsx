"use client";

import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ZoomableImage } from "@/components/media/zoomable-image";
import { mediaVideoPreviewSrc } from "@/components/media/media-thumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type SwipeGallerySlide = {
  src: string;
  type?: "photo" | "video";
  label?: string;
};

function scrollScrollerTo(scroller: HTMLDivElement | null, next: number, behavior: ScrollBehavior) {
  if (!scroller || scroller.clientWidth === 0) return;
  scroller.scrollTo({ left: next * scroller.clientWidth, behavior });
}

function GalleryVideo({
  src,
  active,
  className,
}: {
  src: string;
  active: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!active) {
      ref.current?.pause();
    }
  }, [active]);

  return (
    <video
      ref={ref}
      src={src}
      controls={active}
      playsInline
      preload="metadata"
      className={className}
    />
  );
}

export function SwipeGallery({
  images,
  labels,
  items,
}: {
  images?: string[];
  labels?: string[];
  items?: SwipeGallerySlide[];
}) {
  const slides: SwipeGallerySlide[] =
    items ??
    (images ?? []).map((src, index) => ({
      src,
      type: "photo" as const,
      label: labels?.[index],
    }));
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lightboxScrollerRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const slideKey = slides.map((slide) => `${slide.type}:${slide.src}`).join("|");

  indexRef.current = index;

  useEffect(() => {
    setIndex(0);
    scrollerRef.current?.scrollTo({ left: 0 });
  }, [slideKey]);

  const goTo = (next: number, behavior: ScrollBehavior = "smooth") => {
    const clamped = Math.min(slides.length - 1, Math.max(0, next));
    setIndex(clamped);
    scrollScrollerTo(scrollerRef.current, clamped, behavior);
    if (lightbox) {
      scrollScrollerTo(lightboxScrollerRef.current, clamped, behavior);
    }
  };

  useLayoutEffect(() => {
    if (!lightbox) return;
    const sync = () => scrollScrollerTo(lightboxScrollerRef.current, indexRef.current, "auto");
    sync();
    const frame = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(frame);
  }, [lightbox]);

  useEffect(() => {
    if (!lightbox || slides.length <= 1) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(indexRef.current - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(indexRef.current + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox, slides.length]);

  if (slides.length === 0) return null;

  const onScroll = (scroller: HTMLDivElement | null) => {
    if (!scroller || scroller.clientWidth === 0) return;
    const next = Math.round(scroller.scrollLeft / scroller.clientWidth);
    setIndex(Math.min(slides.length - 1, Math.max(0, next)));
  };

  const current = slides[index];
  const currentLabel = current?.label ?? (current?.type === "video" ? "Видео" : "Фото");

  return (
    <>
      <div className="space-y-2">
        <div className="overflow-hidden rounded-lg">
          <div
            ref={scrollerRef}
            onScroll={(event) => onScroll(event.currentTarget)}
            className="flex snap-x snap-mandatory touch-pan-x overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {slides.map((slide, slideIndex) => (
              <button
                key={`${slide.src}-${slideIndex}`}
                type="button"
                className="relative min-w-full shrink-0 basis-full snap-center overflow-hidden"
                onClick={() => {
                  setIndex(slideIndex);
                  setLightbox(true);
                }}
              >
                {slide.type === "video" ? (
                  <>
                    <video
                      src={mediaVideoPreviewSrc(slide.src)}
                      muted
                      playsInline
                      preload="metadata"
                      className="aspect-[4/3] w-full bg-black object-cover"
                    />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                      <Play className="h-12 w-12 text-white/90 drop-shadow" />
                    </span>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slide.src}
                    alt={slide.label ?? ""}
                    className="aspect-[4/3] w-full object-cover"
                    draggable={false}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
        {slides.length > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            {slides.map((_, slideIndex) => (
              <button
                key={slideIndex}
                type="button"
                aria-label={`Слайд ${slideIndex + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  slideIndex === index ? "w-5 bg-foreground" : "w-1.5 bg-muted-foreground/40",
                )}
                onClick={() => goTo(slideIndex)}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={lightbox}
        onOpenChange={(open) => {
          setLightbox(open);
          if (!open) {
            scrollScrollerTo(scrollerRef.current, indexRef.current, "auto");
          }
        }}
      >
        {lightbox ? (
          <DialogContent className="z-[100] flex h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[96dvh] sm:max-w-6xl sm:rounded-xl">
            <DialogHeader className="shrink-0 border-b px-3 py-2 sm:px-4">
              <DialogTitle className="pr-8 text-sm">
                {currentLabel}
                {slides.length > 1 ? ` · ${index + 1} из ${slides.length}` : ""}
              </DialogTitle>
            </DialogHeader>
            <div className="relative flex min-h-0 w-full flex-1 bg-black">
              {slides.length > 1 && (
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
                    disabled={index >= slides.length - 1}
                    onClick={() => goTo(index + 1)}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}
              <div
                ref={lightboxScrollerRef}
                onScroll={(event) => onScroll(event.currentTarget)}
                className="flex h-full w-full snap-x snap-mandatory touch-pan-x overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {slides.map((slide, slideIndex) => (
                  <div
                    key={`${slide.src}-${slideIndex}`}
                    className="flex h-full min-w-full shrink-0 basis-full snap-center items-center justify-center"
                  >
                    {slide.type === "video" ? (
                      <GalleryVideo
                        src={slide.src}
                        active={slideIndex === index}
                        className="max-h-full max-w-full"
                      />
                    ) : (
                      <ZoomableImage
                        src={slide.src}
                        alt={slide.label ?? ""}
                        active={slideIndex === index}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
