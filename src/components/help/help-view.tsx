"use client";

import { BookOpen, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { HelpMarkdown } from "@/components/help/help-markdown";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  HELP_ARTICLES,
  getHelpArticle,
  groupHelpArticlesByCategory,
  searchHelpArticles,
  type HelpArticle,
} from "@/lib/help/articles";
import { cn } from "@/lib/utils";

export function HelpView() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(HELP_ARTICLES[0]?.id ?? "");

  const filtered = useMemo(() => searchHelpArticles(query), [query]);
  const groups = useMemo(() => groupHelpArticlesByCategory(filtered), [filtered]);

  useEffect(() => {
    if (filtered.length === 0) return;
    if (!filtered.some((article) => article.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected: HelpArticle | undefined =
    getHelpArticle(selectedId) ?? filtered[0] ?? HELP_ARTICLES[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:items-start">
      <aside className="rounded-xl border bg-card lg:sticky lg:top-4">
        <div className="border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по вопросам…"
              className="pl-8"
              aria-label="Поиск по инструкциям"
            />
          </div>
        </div>

        <nav className="max-h-[min(70vh,36rem)] space-y-4 overflow-y-auto p-3">
          {groups.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              Ничего не найдено. Попробуйте другой запрос.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.category} className="space-y-1">
                <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                {group.articles.map((article) => {
                  const active = article.id === selected?.id;
                  return (
                    <button
                      key={article.id}
                      type="button"
                      onClick={() => setSelectedId(article.id)}
                      className={cn(
                        "w-full rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                        active
                          ? "bg-brand-muted font-medium text-brand"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {article.title}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </nav>
      </aside>

      <article className="rounded-xl border bg-card p-4 sm:p-6">
        {selected ? (
          <>
            <div className="flex flex-wrap items-start gap-2 border-b pb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold tracking-tight">{selected.title}</h1>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selected.keywords.slice(0, 4).map((keyword) => (
                    <Badge key={keyword} variant="outline" className="font-normal">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="pt-2">
              <HelpMarkdown content={selected.body} />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Выберите статью в списке слева.</p>
        )}
      </article>
    </div>
  );
}
