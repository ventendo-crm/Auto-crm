"use client";

import { Loader2 } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { CustomsEstimateSnapshot } from "@/components/calculator/customs-estimate-snapshot";
import { SwipeGallery } from "@/components/media/swipe-gallery";
import type { PublicCatalogVehicleData } from "@/lib/types/catalog";
import { formatCurrency } from "@/lib/utils";

function BlockDivider() {
  return <div className="h-px bg-border" role="separator" />;
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
        <SwipeGallery
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
