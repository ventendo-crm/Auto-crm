"use client";

import { ArrowDownToLine, Loader2, Search, Share2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible-panel";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { OFFER_VEHICLE_TITLE_MAX } from "@/lib/calculator/offer-share";
import {
  engineKindLabel,
  missingCalculatorData,
  UTIL_SEARCH_TEMPLATE,
  type QuickSearchSuggestion,
} from "@/lib/tavily/calculator-suggestion";

const OFFER_TITLE_STORAGE = "crm-offer-vehicle-title";

function engineCalcLabel(suggestion: QuickSearchSuggestion): string | null {
  if (suggestion.engine === "electric") return "электро";
  if (suggestion.engine === "diesel") return "дизель";
  if (suggestion.engine === "petrol") return "бензин";
  return null;
}

function originLabel(origin: QuickSearchSuggestion["originCountry"]): string | null {
  if (origin === "china") return "Китай";
  if (origin === "korea") return "Корея";
  if (origin === "kyrgyzstan") return "Киргизия";
  return null;
}

function ageLabel(age: QuickSearchSuggestion["age"]): string | null {
  if (age === "new") return "новый";
  if (age === "under3") return "до 3 лет";
  if (age === "from3to5") return "3–5 лет";
  if (age === "from5to7") return "5–7 лет";
  if (age === "over7") return "старше 7 лет";
  return null;
}

function saveOfferTitle(title: string) {
  const value = title.trim().slice(0, OFFER_VEHICLE_TITLE_MAX);
  if (!value) return;
  try {
    sessionStorage.setItem(OFFER_TITLE_STORAGE, value);
  } catch {
    // ignore
  }
}

export function CalculatorQuickSearch({
  onApplyToCalculator,
  onOpenOfferTab,
}: {
  onApplyToCalculator: (suggestion: QuickSearchSuggestion) => void;
  onOpenOfferTab?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<QuickSearchSuggestion | null>(null);
  const [applied, setApplied] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
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
      setSuggestion(result.suggestion);
      setSourcesOpen(false);
      setApplied(false);
    } catch (error) {
      setSummary(null);
      setVariants([]);
      setSuggestion(null);
      setApplied(false);
      toast.error(error instanceof Error ? error.message : "Не удалось выполнить поиск");
    } finally {
      setLoading(false);
    }
  };

  const missing = missingCalculatorData(suggestion);

  const handleApply = () => {
    if (!suggestion || missing.length > 0) {
      toast.error(
        missing.length > 0
          ? `Не хватает: ${missing.join(", ")}`
          : "Не хватает данных, чтобы подставить расчёт",
      );
      return;
    }
    if (suggestion.title) saveOfferTitle(suggestion.title);
    onApplyToCalculator(suggestion);
    setApplied(true);
    const hybridNote =
      suggestion.hybridLayout === "parallel"
        ? " Параллельный гибрид: мощность ДВС + 30-минутная мощность электромотора."
        : suggestion.hybridLayout === "series"
          ? " Последовательный гибрид: 30-минутная мощность электромотора, объём ДВС."
          : suggestion.engine === "electric"
            ? " Электромобиль: 30-минутная мощность."
            : "";
    toast.success(
      suggestion.price
        ? `Параметры перенесены.${hybridNote} Можно отправить КП во вкладке «Подбор».`
        : `Характеристики перенесены.${hybridNote} Укажите цену и нажмите «Рассчитать».`,
    );
    document.getElementById("customs-calculator")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const kind = engineKindLabel(suggestion?.engineKind ?? null);
  const calcEngine = suggestion ? engineCalcLabel(suggestion) : null;

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-4 w-4" />
          ИИ-поиск
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Достаточно марки и модели. Бензин и дизель — объём и мощность ДВС. Электро — 30-минутная
          мощность. Гибрид: последовательный или параллельный. Таблицы утильсбора не используются.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          Бензин и дизель: объём и мощность ДВС. Электромобиль: 30-минутная мощность. Параллельный
          гибрид: мощность ДВС + 30-минутная мощность электромотора. Последовательный: только
          30-минутная мощность электромотора, объём остаётся у ДВС. Перед КП сверьте цифры.
        </div>
        <p className="text-xs text-muted-foreground">
          Шаблон: <span className="font-medium text-foreground">{UTIL_SEARCH_TEMPLATE}</span>
        </p>
        <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-row gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Марка и модель, например Trumpchi S7"
            disabled={loading}
            className="min-w-0 flex-1"
            aria-label="Марка и модель для расчёта утильсбора"
          />
          <Button type="submit" variant="brand" disabled={loading} className="shrink-0">
            {loading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-1.5 h-4 w-4" />
            )}
            Найти
          </Button>
        </form>

        {(summary || suggestion || variants.length > 0) && (
          <div className="space-y-3">
            {summary && (
              <div className="rounded-xl border bg-muted/20 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Краткий вывод
                </p>
                <p className="mt-1 text-sm leading-relaxed">{summary}</p>
              </div>
            )}

            {!suggestion && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
                <p className="font-medium">Не хватает данных</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {missing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {suggestion && (
              <div className="space-y-3 rounded-xl border px-4 py-3">
                <p className="text-sm font-medium">Для калькулятора</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {suggestion.title && (
                    <li>
                      Авто: <span className="text-foreground">{suggestion.title}</span>
                    </li>
                  )}
                  {originLabel(suggestion.originCountry) && (
                    <li>
                      Страна:{" "}
                      <span className="text-foreground">{originLabel(suggestion.originCountry)}</span>
                    </li>
                  )}
                  {ageLabel(suggestion.age) && (
                    <li>
                      Возраст: <span className="text-foreground">{ageLabel(suggestion.age)}</span>
                    </li>
                  )}
                  {kind && (
                    <li>
                      Тип: <span className="text-foreground">{kind}</span>
                      {calcEngine ? ` → в калькуляторе ${calcEngine}` : null}
                    </li>
                  )}
                  {suggestion.powerHp != null && (
                    <li>
                      Мощность:{" "}
                      <span className="text-foreground">{suggestion.powerHp} л.с.</span>
                      {suggestion.hybridLayout === "parallel" &&
                      suggestion.icePowerHp &&
                      suggestion.electricPowerHp
                        ? ` (${suggestion.icePowerHp} ДВС + ${suggestion.electricPowerHp} электро, 30-мин.)`
                        : suggestion.hybridLayout === "series" || suggestion.engine === "electric"
                          ? " (30-минутная)"
                          : " (ДВС)"}
                    </li>
                  )}
                  {suggestion.volumeCc != null && suggestion.engine !== "electric" && (
                    <li>
                      Объём: <span className="text-foreground">{suggestion.volumeCc} см³</span>
                    </li>
                  )}
                  {suggestion.price != null && (
                    <li>
                      Цена:{" "}
                      <span className="text-foreground">
                        {suggestion.price.toLocaleString("ru-RU")} {suggestion.currency ?? ""}
                      </span>
                    </li>
                  )}
                </ul>
                {suggestion.note && (
                  <p className="text-xs leading-relaxed text-muted-foreground">{suggestion.note}</p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="brand"
                    className="w-full sm:w-auto"
                    disabled={missing.length > 0}
                    onClick={handleApply}
                  >
                    <ArrowDownToLine className="mr-1.5 h-4 w-4" />
                    Перенести в калькулятор
                  </Button>
                  {applied && onOpenOfferTab && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={onOpenOfferTab}
                    >
                      <Share2 className="mr-1.5 h-4 w-4" />
                      Открыть Подбор
                    </Button>
                  )}
                </div>
                {missing.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
                    <p className="font-medium">Не хватает данных</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {missing.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {variants.length > 0 && (
              <div className="rounded-xl border">
                <CollapsibleTrigger
                  open={sourcesOpen}
                  onToggle={() => setSourcesOpen((open) => !open)}
                  className="px-4 py-3"
                >
                  <span className="text-sm font-medium">Источники ({variants.length})</span>
                </CollapsibleTrigger>
                <CollapsiblePanel open={sourcesOpen}>
                  <div className="space-y-2 border-t px-4 py-3">
                    {variants.map((variant, index) => (
                      <div
                        key={`${variant.sourceUrl ?? "no-url"}-${index}`}
                        className="rounded-xl border px-4 py-3"
                      >
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
                </CollapsiblePanel>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
