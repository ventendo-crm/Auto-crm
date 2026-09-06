"use client";

import { ChevronLeft, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ZoomableImage } from "@/components/media/zoomable-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PublicCalculatorOffer } from "@/lib/calculator/offer-share";

function formatExpiry(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function SourceListingLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-brand underline-offset-4 hover:underline"
    >
      Ссылка на объявление
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function OfferImageGallery({
  images,
  labels,
}: {
  images: string[];
  labels: string[];
}) {
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
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {images.map((url, imageIndex) => (
          <button
            key={url}
            type="button"
            onClick={() => setIndex(imageIndex)}
            className="block overflow-hidden rounded-lg border text-left"
          >
            <img src={url} alt={labels[imageIndex] ?? ""} className="aspect-square w-full object-cover" />
          </button>
        ))}
      </section>

      <Dialog open={open} onOpenChange={(next) => !next && setIndex(null)}>
        {current && index != null ? (
          <DialogContent className="z-[100] flex w-[calc(100%-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
            <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6 sm:py-4">
              <DialogTitle className="pr-8 text-base">
                {labels[index] ?? "Фото"}
                {images.length > 1 ? ` · ${index + 1} из ${images.length}` : ""}
              </DialogTitle>
            </DialogHeader>
            <div className="relative flex w-full min-w-0 items-center justify-center bg-black/5 p-2 sm:p-4">
              {images.length > 1 && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-1/2 z-10 -translate-y-1/2 shadow-md sm:left-4"
                    disabled={!hasPrev}
                    onClick={() => setIndex(index - 1)}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-1/2 z-10 -translate-y-1/2 shadow-md sm:right-4"
                    disabled={!hasNext}
                    onClick={() => setIndex(index + 1)}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}
              <div className="flex w-full min-w-0 max-w-full items-center justify-center px-8 sm:px-12">
                <ZoomableImage key={current} src={current} alt={labels[index] ?? ""} />
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

export function PublicCalculatorOfferView({ token }: { token: string }) {
  const [data, setData] = useState<PublicCalculatorOffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [estimateOpen, setEstimateOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/public/offers/${token}`);
        const json = (await response.json()) as {
          success?: boolean;
          data?: PublicCalculatorOffer;
          error?: string;
        };
        if (!response.ok || !json.success || !json.data) {
          setError(json.error ?? "Подбор недоступен");
          return;
        }
        setData(json.data);
        document.title = json.data.companyName
          ? `${json.data.companyName} — расчёт авто`
          : "Расчёт авто";
      } catch {
        setError("Не удалось загрузить подбор");
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
          <h1 className="text-xl font-semibold">Подбор недоступен</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const photoLabels = data.photoUrls.map((_, index) => `Фото ${index + 1}`);

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          {data.companyName && (
            <p className="text-sm text-muted-foreground">{data.companyName}</p>
          )}
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Расчёт авто</h1>
          {data.totalLabel && (
            <p className="mt-3 text-lg font-semibold">Итого: {data.totalLabel}</p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
        {data.description && (
          <section className="whitespace-pre-wrap text-[15px] leading-relaxed">
            {data.description}
          </section>
        )}

        <OfferImageGallery images={data.photoUrls} labels={photoLabels} />

        {data.estimateUrl && (
          <section className="space-y-2">
            <h2 className="text-base font-semibold">Расчёт стоимости</h2>
            <button
              type="button"
              onClick={() => setEstimateOpen(true)}
              className="block w-full overflow-hidden rounded-xl border bg-white text-left"
            >
              <img src={data.estimateUrl} alt="Расчёт растаможки" className="w-full" />
            </button>
            <Dialog open={estimateOpen} onOpenChange={setEstimateOpen}>
              <DialogContent className="z-[100] flex w-[calc(100%-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
                <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6 sm:py-4">
                  <DialogTitle className="pr-8 text-base">Расчёт стоимости</DialogTitle>
                </DialogHeader>
                <div className="flex w-full min-w-0 items-center justify-center bg-black/5 p-2 sm:p-4">
                  <ZoomableImage src={data.estimateUrl} alt="Расчёт растаможки" />
                </div>
              </DialogContent>
            </Dialog>
          </section>
        )}

        {data.sourceUrl && <SourceListingLink href={data.sourceUrl} />}

        <p className="text-center text-xs text-muted-foreground">
          Ссылка действует до {formatExpiry(data.expiresAt)}
        </p>
      </main>
    </div>
  );
}
