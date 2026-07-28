"use client";

import { Loader2, Search } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";

export function CalculatorQuickSearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [variants, setVariants] = useState<
    Array<{ answer: string; sourceUrl: string | null; sourceTitle: string | null }>
  >([]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      toast.error("Введите запрос от 3 символов");
      return;
    }

    setLoading(true);
    try {
      const result = await api.quickSearch.search(trimmed);
      setSummary(result.summary);
      setVariants(result.variants);
    } catch (error) {
      setSummary(null);
      setVariants([]);
      toast.error(error instanceof Error ? error.message : "Не удалось выполнить поиск");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-4 w-4" />
          Быстрый поиск
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Короткий ответ из интернета — например, «30-ти минутная мощность Changan Q05»
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Введите запрос…"
            disabled={loading}
            className="sm:flex-1"
          />
          <Button type="submit" variant="brand" disabled={loading} className="sm:w-auto">
            {loading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-1.5 h-4 w-4" />
            )}
            Найти
          </Button>
        </form>

        {summary && (
          <div className="space-y-3">
            <div className="rounded-xl border bg-muted/20 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Краткий вывод
              </p>
              <p className="mt-1 text-sm leading-relaxed">{summary}</p>
            </div>

            {variants.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Найденные варианты</p>
                {variants.map((variant, index) => (
                  <div key={`${variant.sourceUrl ?? "no-url"}-${index}`} className="rounded-xl border px-4 py-3">
                    <p className="text-sm leading-relaxed">{variant.answer}</p>
                    {variant.sourceUrl && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Источник:{" "}
                        <a
                          href={variant.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          {variant.sourceTitle || variant.sourceUrl}
                        </a>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
