"use client";

import { ChevronLeft, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
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

function BlockDivider() {
  return <div className="h-px bg-border" role="separator" />;
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
      <section className="grid grid-cols-2 gap-1 sm:grid-cols-3">
        {images.map((url, imageIndex) => (
          <button
            key={url}
            type="button"
            onClick={() => setIndex(imageIndex)}
            className="block overflow-hidden rounded-md text-left"
          >
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
            <div className="relative flex min-h-0 flex-1 w-full items-center justify-center bg-black">
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
        const title = json.data.vehicleTitle || "Расчёт авто";
        document.title = json.data.companyName ? `${json.data.companyName} — ${title}` : title;
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
  const heading = data.vehicleTitle || "Расчёт авто";

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          {data.companyName && (
            <p className="text-sm text-muted-foreground">{data.companyName}</p>
          )}
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{heading}</h1>
          {data.totalLabel && (
            <p className="mt-3 text-lg font-semibold">Итого: {data.totalLabel}</p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        {[
          data.photoUrls.length > 0 ? (
            <OfferImageGallery key="photos" images={data.photoUrls} labels={photoLabels} />
          ) : null,
          data.description ? (
            <section key="description" className="space-y-2">
              <h2 className="text-base font-semibold">Комплектация</h2>
              <div className="whitespace-pre-wrap text-[15px] leading-relaxed">{data.description}</div>
            </section>
          ) : null,
          data.estimateUrl ? (
            <section key="estimate" className="space-y-2">
              <h2 className="text-base font-semibold">Расчёт стоимости</h2>
              <button
                type="button"
                onClick={() => setEstimateOpen(true)}
                className="block w-full overflow-hidden rounded-lg bg-white text-left"
              >
                <img src={data.estimateUrl} alt="Расчёт растаможки" className="w-full" />
              </button>
              <Dialog open={estimateOpen} onOpenChange={setEstimateOpen}>
                <DialogContent className="z-[100] flex h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[96dvh] sm:max-w-6xl sm:rounded-xl">
                  <DialogHeader className="shrink-0 border-b px-3 py-2 sm:px-4">
                    <DialogTitle className="pr-8 text-sm">Расчёт стоимости</DialogTitle>
                  </DialogHeader>
                  <div className="flex min-h-0 flex-1 w-full items-center justify-center bg-black">
                    <ZoomableImage src={data.estimateUrl} alt="Расчёт растаможки" />
                  </div>
                </DialogContent>
              </Dialog>
            </section>
          ) : null,
          data.sourceUrl ? <SourceListingLink key="source" href={data.sourceUrl} /> : null,
        ]
          .filter(Boolean)
          .map((block, index) => (
            <Fragment key={index}>
              {index > 0 && <BlockDivider />}
              {block}
            </Fragment>
          ))}

        <BlockDivider />
        <p className="text-center text-xs text-muted-foreground">
          Ссылка действует до {formatExpiry(data.expiresAt)}
        </p>
      </main>
    </div>
  );
}
