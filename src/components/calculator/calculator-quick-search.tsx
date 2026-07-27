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
  const [answer, setAnswer] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceTitle, setSourceTitle] = useState<string | null>(null);

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
      setAnswer(result.answer);
      setSourceUrl(result.sourceUrl);
      setSourceTitle(result.sourceTitle);
    } catch (error) {
      setAnswer(null);
      setSourceUrl(null);
      setSourceTitle(null);
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

        {answer && (
          <div className="rounded-xl border bg-muted/20 px-4 py-3">
            <p className="text-sm leading-relaxed">{answer}</p>
            {sourceUrl && (
              <p className="mt-2 text-xs text-muted-foreground">
                Источник:{" "}
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {sourceTitle || sourceUrl}
                </a>
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
