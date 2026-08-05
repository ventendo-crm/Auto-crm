"use client";

import { BookOpen, MessageSquarePlus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { HelpFeedbackForm } from "@/components/help/help-feedback-form";
import { HelpMarkdown } from "@/components/help/help-markdown";
import { Input } from "@/components/ui/input";
import {
  HELP_ARTICLES,
  getHelpArticle,
  groupHelpArticlesByCategory,
  searchHelpArticles,
  type HelpArticle,
} from "@/lib/help/articles";
import { cn } from "@/lib/utils";

const FEEDBACK_ID = "__feedback__";

export function HelpView() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(HELP_ARTICLES[0]?.id ?? FEEDBACK_ID);
  const showFeedback = selectedId === FEEDBACK_ID;

  const filtered = useMemo(() => searchHelpArticles(query), [query]);
  const groups = useMemo(() => groupHelpArticlesByCategory(filtered), [filtered]);

  useEffect(() => {
    if (showFeedback) return;
    if (filtered.length === 0) return;
    if (!filtered.some((article) => article.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId, showFeedback]);

  const selected: HelpArticle | undefined = showFeedback
    ? undefined
    : getHelpArticle(selectedId) ?? filtered[0] ?? HELP_ARTICLES[0];

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
                  const active = !showFeedback && article.id === selected?.id;
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

        <div className="border-t p-3">
          <button
            type="button"
            onClick={() => setSelectedId(FEEDBACK_ID)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
              showFeedback
                ? "bg-brand-muted font-medium text-brand"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <MessageSquarePlus className="h-4 w-4 shrink-0" />
            Обратная связь
          </button>
        </div>
      </aside>

      <article className="rounded-xl border bg-card p-4 sm:p-6">
        {showFeedback ? (
          <HelpFeedbackForm />
        ) : selected ? (
          <>
            <div className="flex flex-wrap items-start gap-2 border-b pb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold tracking-tight">{selected.title}</h1>
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
