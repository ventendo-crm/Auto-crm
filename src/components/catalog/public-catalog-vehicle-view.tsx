"use client";

import { Loader2 } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { CustomsEstimateSnapshot } from "@/components/calculator/customs-estimate-snapshot";
import { SwipeGallery } from "@/components/media/swipe-gallery";
import type { PublicCatalogTrim, PublicCatalogVehicleData } from "@/lib/types/catalog";
import { cn, formatCurrency } from "@/lib/utils";

function BlockDivider() {
  return <div className="h-px bg-border" role="separator" />;
}

export function PublicCatalogVehicleView({ token }: { token: string }) {
  const [data, setData] = useState<PublicCatalogVehicleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedTrimId, setSelectedTrimId] = useState<string>("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/public/catalog/${token}`);
        const json = await response.json();
        if (!response.ok || !json.success) {
          setError(json.error ?? "Авто недоступно");
          return;
        }
        const next = json.data as PublicCatalogVehicleData;
        setData(next);
        setSelectedTrimId(next.trims[0]?.id ?? "");
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

  const trims = data.trims ?? [];
  const selectedTrim: PublicCatalogTrim | null =
    trims.find((trim) => trim.id === selectedTrimId) ?? trims[0] ?? null;
  const displayTotal = selectedTrim?.totalWithCar ?? data.totalWithCar;
  const estimateInput = selectedTrim?.estimateInput ?? data.estimateInput;
  const estimateResult = selectedTrim?.estimateResult ?? data.estimateResult;

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <p className="text-sm text-muted-foreground">{data.companyName}</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{data.title}</h1>
          {displayTotal != null && (
            <p className="mt-3 text-2xl font-semibold">{formatCurrency(displayTotal)}</p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <SwipeGallery
          items={(data.media ?? data.photos.map((url) => ({ url, type: "photo" as const }))).map(
            (item, index) => ({
              src: item.url,
              type: item.type,
              label:
                item.type === "video" ? `${data.title} · видео` : `${data.title} · фото ${index + 1}`,
            }),
          )}
        />

        {trims.length > 1 ? (
          <Fragment>
            <BlockDivider />
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Комплектации</h2>
              <div className="flex flex-wrap gap-2">
                {trims.map((trim) => (
                  <button
                    key={trim.id}
                    type="button"
                    aria-pressed={trim.id === selectedTrim?.id}
                    onClick={() => setSelectedTrimId(trim.id)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm",
                      trim.id === selectedTrim?.id
                        ? "border-brand/40 bg-brand-muted/50 font-medium"
                        : "hover:bg-muted",
                    )}
                  >
                    <span className="block">{trim.title}</span>
                    {trim.totalWithCar != null ? (
                      <span className="block text-xs text-muted-foreground">
                        {formatCurrency(trim.totalWithCar)}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          </Fragment>
        ) : selectedTrim && selectedTrim.title && selectedTrim.title !== "Базовая" ? (
          <p className="text-sm text-muted-foreground">Комплектация: {selectedTrim.title}</p>
        ) : null}

        {data.description.trim() ? (
          <Fragment>
            <BlockDivider />
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Описание</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{data.description}</p>
            </section>
          </Fragment>
        ) : null}

        {estimateInput && estimateResult ? (
          <Fragment>
            <BlockDivider />
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Расчёт «под ключ»</h2>
              {selectedTrim ? (
                <p className="text-sm text-muted-foreground">{selectedTrim.title}</p>
              ) : null}
              {displayTotal != null && (
                <p className="text-xl font-semibold">Итого: {formatCurrency(displayTotal)}</p>
              )}
              <CustomsEstimateSnapshot input={estimateInput} result={estimateResult} />
            </section>
          </Fragment>
        ) : null}
      </main>
    </div>
  );
}
