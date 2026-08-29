"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { CustomsEstimateSnapshot } from "@/components/calculator/customs-estimate-snapshot";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicSelectionData } from "@/lib/types/catalog";
import { formatCurrency } from "@/lib/utils";
import type {
  CustomsCalculatorInput,
  CustomsCalculatorResult,
} from "@/lib/customs-calculator";

export function PublicSelectionView({ token }: { token: string }) {
  const [data, setData] = useState<PublicSelectionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/public/selections/${token}`);
        const json = await response.json();
        if (!response.ok || !json.success) {
          setError(json.error ?? "Подборка недоступна");
          return;
        }
        setData(json.data as PublicSelectionData);
      } catch {
        setError("Не удалось загрузить подборку");
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
          <h1 className="text-xl font-semibold">Подборка недоступна</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <p className="text-sm text-muted-foreground">{data.companyName}</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{data.title}</h1>
          {data.note && <p className="mt-3 text-muted-foreground">{data.note}</p>}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        {data.items.map((item, index) => {
          const images = item.vehicle.galleryUrls.length
            ? item.vehicle.galleryUrls
            : item.vehicle.coverImageUrl
              ? [item.vehicle.coverImageUrl]
              : [];
          const estimateResult = item.vehicle.estimateResult as CustomsCalculatorResult | null;
          const estimateInput = item.vehicle.estimateInput as CustomsCalculatorInput | null;

          return (
            <Card key={item.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Вариант {index + 1}</p>
                    <CardTitle className="text-xl">{item.vehicle.titleRu}</CardTitle>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
                      {item.vehicle.carYear && <span>{item.vehicle.carYear} г.</span>}
                      {item.vehicle.mileageKm != null && (
                        <span>{item.vehicle.mileageKm.toLocaleString("ru-RU")} км</span>
                      )}
                      {item.vehicle.brand && <span>{item.vehicle.brand}</span>}
                    </div>
                  </div>
                  {item.vehicle.estimateTotal != null && (
                    <Badge className="text-base">{formatCurrency(item.vehicle.estimateTotal)}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {images.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {images.slice(0, 6).map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={url}
                        src={url}
                        alt=""
                        className="aspect-[4/3] w-full rounded-lg object-cover"
                      />
                    ))}
                  </div>
                )}
                {item.vehicle.videoUrl && (
                  <video controls className="w-full rounded-lg" src={item.vehicle.videoUrl} />
                )}
                {item.vehicle.descriptionRu && (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {item.vehicle.descriptionRu}
                  </p>
                )}
                {item.vehicle.priceCny != null && (
                  <p className="text-sm text-muted-foreground">
                    Цена в Китае: {item.vehicle.priceCny.toLocaleString("ru-RU")} ¥
                  </p>
                )}
                {estimateResult && estimateInput && (
                  <CustomsEstimateSnapshot input={estimateInput} result={estimateResult} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </main>
    </div>
  );
}
