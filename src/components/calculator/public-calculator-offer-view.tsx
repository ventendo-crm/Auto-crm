"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { ZoomableImage } from "@/components/media/zoomable-image";
import { SwipeGallery } from "@/components/media/swipe-gallery";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PublicCalculatorOffer, PublicCalculatorOfferItem } from "@/lib/calculator/offer-share";

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

function OfferItemBlocks({
  item,
  estimateOpen,
  onEstimateOpenChange,
}: {
  item: PublicCalculatorOfferItem;
  estimateOpen: boolean;
  onEstimateOpenChange: (open: boolean) => void;
}) {
  const photoLabels = item.photoUrls.map((_, index) => `Фото ${index + 1}`);

  return (
    <>
      {[
        item.photoUrls.length > 0 ? (
          <SwipeGallery key="photos" images={item.photoUrls} labels={photoLabels} />
        ) : null,
        item.description ? (
          <section key="description" className="space-y-2">
            <h2 className="text-base font-semibold">Комплектация</h2>
            <div className="whitespace-pre-wrap text-[15px] leading-relaxed">{item.description}</div>
          </section>
        ) : null,
        item.estimateUrl ? (
          <section key="estimate" className="space-y-2">
            <h2 className="text-base font-semibold">Расчёт стоимости</h2>
            <button
              type="button"
              onClick={() => onEstimateOpenChange(true)}
              className="block w-full overflow-hidden rounded-lg bg-white text-left"
            >
              <img src={item.estimateUrl} alt="Расчёт растаможки" className="w-full" />
            </button>
            <Dialog open={estimateOpen} onOpenChange={onEstimateOpenChange}>
              <DialogContent className="z-[100] flex h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[96dvh] sm:max-w-6xl sm:rounded-xl">
                <DialogHeader className="shrink-0 border-b px-3 py-2 sm:px-4">
                  <DialogTitle className="pr-8 text-sm">Расчёт стоимости</DialogTitle>
                </DialogHeader>
                <div className="flex min-h-0 flex-1 w-full items-center justify-center bg-black">
                  <ZoomableImage src={item.estimateUrl} alt="Расчёт растаможки" />
                </div>
              </DialogContent>
            </Dialog>
          </section>
        ) : null,
        item.sourceUrl ? <SourceListingLink key="source" href={item.sourceUrl} /> : null,
      ]
        .filter(Boolean)
        .map((block, index) => (
          <Fragment key={index}>
            {index > 0 && <BlockDivider />}
            {block}
          </Fragment>
        ))}
    </>
  );
}

export function PublicCalculatorOfferView({ token }: { token: string }) {
  const [data, setData] = useState<PublicCalculatorOffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [estimateOpenIndex, setEstimateOpenIndex] = useState<number | null>(null);

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
        const firstTitle = json.data.items[0]?.vehicleTitle;
        const title =
          json.data.items.length > 1
            ? json.data.selectionTitle || `Подборка (${json.data.items.length} авто)`
            : firstTitle || json.data.selectionTitle || "Расчёт авто";
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

  if (error || !data || data.items.length === 0) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Подбор недоступен</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const isSelection = data.items.length > 1;
  const first = data.items[0]!;
  const heading = isSelection
    ? data.selectionTitle || `Подборка (${data.items.length} авто)`
    : first.vehicleTitle || data.selectionTitle || "Расчёт авто";

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          {data.companyName && <p className="text-sm text-muted-foreground">{data.companyName}</p>}
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{heading}</h1>
          {!isSelection && first.totalLabel && (
            <p className="mt-3 text-lg font-semibold">Итого: {first.totalLabel}</p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        {isSelection
          ? data.items.map((item, index) => (
              <section key={`${item.vehicleTitle ?? "item"}-${index}`} className="space-y-4">
                {index > 0 && <BlockDivider />}
                <div>
                  <p className="text-sm text-muted-foreground">Вариант {index + 1}</p>
                  <h2 className="mt-1 text-xl font-semibold">{item.vehicleTitle || `Вариант ${index + 1}`}</h2>
                  {item.totalLabel && (
                    <p className="mt-2 text-lg font-semibold">Итого: {item.totalLabel}</p>
                  )}
                </div>
                <div className="space-y-6">
                  <OfferItemBlocks
                    item={item}
                    estimateOpen={estimateOpenIndex === index}
                    onEstimateOpenChange={(open) => setEstimateOpenIndex(open ? index : null)}
                  />
                </div>
              </section>
            ))
          : (
              <div className="space-y-6">
                <OfferItemBlocks
                  item={first}
                  estimateOpen={estimateOpenIndex === 0}
                  onEstimateOpenChange={(open) => setEstimateOpenIndex(open ? 0 : null)}
                />
              </div>
            )}

        <BlockDivider />
        <p className="text-center text-xs text-muted-foreground">
          Ссылка действует до {formatExpiry(data.expiresAt)}
        </p>
      </main>
    </div>
  );
}
