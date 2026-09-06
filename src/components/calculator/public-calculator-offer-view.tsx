"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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

export function PublicCalculatorOfferView({ token }: { token: string }) {
  const [data, setData] = useState<PublicCalculatorOffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
          ? `${json.data.companyName} — подбор авто`
          : "Подбор авто";
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

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          {data.companyName && (
            <p className="text-sm text-muted-foreground">{data.companyName}</p>
          )}
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Подбор авто</h1>
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

        {data.sourceUrl && (
          <a
            href={data.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-brand underline-offset-4 hover:underline"
          >
            Ссылка на объявление
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        {data.photoUrls.length > 0 && (
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {data.photoUrls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
                <img
                  src={url}
                  alt=""
                  className="aspect-square w-full rounded-lg border object-cover"
                />
              </a>
            ))}
          </section>
        )}

        {data.estimateUrl && (
          <section className="space-y-2">
            <h2 className="text-base font-semibold">Расчёт стоимости</h2>
            <a href={data.estimateUrl} target="_blank" rel="noreferrer">
              <img
                src={data.estimateUrl}
                alt="Расчёт растаможки"
                className="w-full rounded-xl border bg-white"
              />
            </a>
          </section>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Ссылка действует до {formatExpiry(data.expiresAt)}
        </p>
      </main>
    </div>
  );
}
