"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Package } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STAGE_COLORS, STAGE_LABELS } from "@/lib/constants";
import { DashboardArrivalEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function formatMonthEventsLabel(count: number): string {
  if (count === 0) return "В этом месяце дат таможни нет";

  const mod10 = count % 10;
  const mod100 = count % 100;
  let word = "сделок";

  if (mod10 === 1 && mod100 !== 11) word = "сделка";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = "сделки";

  return `${count} ${word} в этом месяце`;
}

interface ArrivalCalendarProps {
  events: DashboardArrivalEvent[];
}

export function ArrivalCalendar({ events }: ArrivalCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  const eventsByDay = useMemo(() => {
    const map = new Map<string, DashboardArrivalEvent[]>();

    for (const event of events) {
      const key = toDateKey(parseISO(event.date));
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }

    return map;
  }, [events]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  const selectedEvents = eventsByDay.get(toDateKey(selectedDay)) ?? [];

  const monthEventsCount = useMemo(
    () =>
      events.filter((event) => isSameMonth(parseISO(event.date), month)).length,
    [events, month],
  );

  const goToToday = () => {
    const today = new Date();
    setMonth(startOfMonth(today));
    setSelectedDay(today);
  };

  return (
    <Card className="overflow-hidden border-0 shadow-card">
      <CardHeader className="border-b bg-gradient-to-r from-rose-50/80 via-background to-background pb-4 dark:from-rose-950/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2.5 leading-tight">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
                <CalendarDays className="h-4 w-4" />
              </span>
              <span>
                Календарь таможни
                <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
                  {formatMonthEventsLabel(monthEventsCount)}
                </span>
              </span>
            </CardTitle>
          </div>

          <div className="flex w-full shrink-0 items-center gap-2 lg:w-auto">
            <div className="flex flex-1 items-center justify-between gap-1 rounded-xl border bg-card/80 p-1 shadow-sm backdrop-blur sm:flex-none">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setMonth((current) => subMonths(current, 1))}
                aria-label="Предыдущий месяц"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[8.5rem] px-1 text-center text-sm font-semibold capitalize">
                {format(month, "LLLL yyyy", { locale: ru })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setMonth((current) => addMonths(current, 1))}
                aria-label="Следующий месяц"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={goToToday}>
              Сегодня
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="rounded-xl border bg-muted/20 p-3 sm:p-4">
          <div className="mb-2 grid grid-cols-7 gap-1 sm:mb-3 sm:gap-1.5">
            {WEEKDAYS.map((day, index) => (
              <div
                key={day}
                className={cn(
                  "py-1 text-center text-micro font-semibold uppercase tracking-wide sm:text-xs",
                  index >= 5 ? "text-rose-500/80" : "text-muted-foreground",
                )}
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {calendarDays.map((day) => {
              const dayKey = toDateKey(day);
              const dayEvents = eventsByDay.get(dayKey) ?? [];
              const inMonth = isSameMonth(day, month);
              const selected = isSameDay(day, selectedDay);
              const today = isToday(day);
              const hasEvents = dayEvents.length > 0;

              return (
                <button
                  key={dayKey}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "group relative flex aspect-square min-w-0 flex-col items-center justify-between rounded-xl border p-1 transition-all duration-normal sm:aspect-auto sm:min-h-[4.25rem] sm:p-2",
                    inMonth ? "bg-card" : "border-transparent bg-transparent text-muted-foreground/50",
                    hasEvents &&
                      inMonth &&
                      !selected &&
                      "border-rose-200/70 bg-rose-50/70 hover:border-rose-300 hover:bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/20 dark:hover:bg-rose-950/30",
                    selected &&
                      "border-brand bg-brand-muted/40 shadow-sm ring-2 ring-brand/20",
                    !selected && inMonth && !hasEvents && "border-border/50 hover:border-border hover:bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold sm:h-7 sm:w-7",
                      today && !selected && "bg-brand text-brand-foreground shadow-sm",
                      today && selected && "bg-brand text-brand-foreground",
                      !today && selected && "text-foreground",
                      !today && !selected && inMonth && "text-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>

                  {hasEvents && inMonth && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                        selected
                          ? "bg-brand text-brand-foreground"
                          : "bg-rose-500 text-white dark:bg-rose-600",
                      )}
                    >
                      {dayEvents.length} авто
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-rose-200/60 bg-gradient-to-b from-rose-50/50 to-background dark:border-rose-900/40 dark:from-rose-950/20">
          <div className="flex items-center justify-between gap-3 border-b border-rose-200/50 px-4 py-3 dark:border-rose-900/40">
            <div>
              <p className="text-section-title capitalize">
                {format(selectedDay, "EEEE, d MMMM", { locale: ru })}
              </p>
              <p className="text-micro text-muted-foreground">Дата таможни из логистики</p>
            </div>
            <Badge
              variant="outline"
              className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
            >
              {selectedEvents.length}
            </Badge>
          </div>

          <div className="p-4">
            {selectedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-background/60 px-6 py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">В этот день таможни нет</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Укажите дату в разделе «Логистика» карточки сделки
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((event) => (
                  <Link
                    key={`${event.dealId}-${event.kind}`}
                    href={`/deals/${event.dealId}`}
                    className="group flex items-center gap-3 rounded-xl border border-rose-200/50 bg-card p-3 shadow-sm transition-all duration-normal hover:border-rose-300 hover:shadow-md dark:border-rose-900/40"
                  >
                    <span className="h-10 w-1 shrink-0 rounded-full bg-rose-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium group-hover:text-brand">{event.clientName}</p>
                      <p className="truncate text-xs text-muted-foreground">{event.carLabel}</p>
                      <p className="truncate font-mono text-micro text-muted-foreground">{event.vin}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="outline" className={STAGE_COLORS[event.currentStage]}>
                        {STAGE_LABELS[event.currentStage]}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
