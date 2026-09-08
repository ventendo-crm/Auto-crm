"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { CustomsEstimateSnapshot } from "@/components/calculator/customs-estimate-snapshot";
import { ZoomableImage } from "@/components/media/zoomable-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PublicCatalogVehicleData } from "@/lib/types/catalog";
import { formatCurrency } from "@/lib/utils";

function BlockDivider() {
  return <div className="h-px bg-border" role="separator" />;
}

function ImageGallery({ images, labels }: { images: string[]; labels: string[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const open = index != null;
  const current = index != null ? images[index] : null;
  const hasPrev = index != null && index > 0;
  const hasNext = index != null && index < images.length - 1;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex((currentIndex) =>
          currentIndex != null && currentIndex > 0 ? currentIndex - 1 : currentIndex,
        );
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setIndex((currentIndex) =>
          currentIndex != null && currentIndex < images.length - 1
            ? currentIndex + 1
            : currentIndex,
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, images.length]);

  if (images.length === 0) return null;

  return (
    <>
      <section className="grid grid-cols-2 gap-1 sm:grid-cols-3">
        {images.map((url, imageIndex) => (
          <button
            key={`${url}-${imageIndex}`}
            type="button"
            onClick={() => setIndex(imageIndex)}
            className="block overflow-hidden rounded-md text-left"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={labels[imageIndex] ?? ""} className="aspect-[4/3] w-full object-cover" />
          </button>
        ))}
      </section>

      <Dialog open={open} onOpenChange={(next) => !next && setIndex(null)}>
        {current && index != null ? (
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
                    disabled={!hasPrev}
                    onClick={() => setIndex(index - 1)}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-1 top-1/2 z-10 -translate-y-1/2 bg-background/80 shadow-md sm:right-3"
                    disabled={!hasNext}
                    onClick={() => setIndex(index + 1)}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}
              <div className="flex h-full w-full min-w-0 items-center justify-center">
                <ZoomableImage key={current} src={current} alt={labels[index] ?? ""} />
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

export function PublicCatalogVehicleView({ token }: { token: string }) {
  const [data, setData] = useState<PublicCatalogVehicleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/public/catalog/${token}`);
        const json = await response.json();
        if (!response.ok || !json.success) {
          setError(json.error ?? "Авто недоступно");
          return;
        }
        setData(json.data as PublicCatalogVehicleData);
      } catch {
        setError("Не удалось загрузить авто");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Авто недоступно</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <p className="text-sm text-muted-foreground">{data.companyName}</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{data.title}</h1>
          {data.totalWithCar != null && (
            <p className="mt-3 text-2xl font-semibold">{formatCurrency(data.totalWithCar)}</p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <ImageGallery
          images={data.photos}
          labels={data.photos.map((_, index) => `${data.title} · фото ${index + 1}`)}
        />

        {data.description.trim() ? (
          <Fragment>
            <BlockDivider />
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Комплектация</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{data.description}</p>
            </section>
          </Fragment>
        ) : null}

        {data.estimateInput && data.estimateResult ? (
          <Fragment>
            <BlockDivider />
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Расчёт «под ключ»</h2>
              {data.totalWithCar != null && (
                <p className="text-xl font-semibold">Итого: {formatCurrency(data.totalWithCar)}</p>
              )}
              <CustomsEstimateSnapshot input={data.estimateInput} result={data.estimateResult} />
            </section>
          </Fragment>
        ) : null}
      </main>
    </div>
  );
}
