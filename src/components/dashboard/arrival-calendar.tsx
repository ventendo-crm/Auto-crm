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
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STAGE_LABELS } from "@/lib/constants";
import { DashboardArrivalEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
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

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-brand" />
            Календарь прибытий
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {monthEventsCount > 0
              ? `${monthEventsCount} авто в этом месяце`
              : "В этом месяце прибытий нет"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setMonth((current) => subMonths(current, 1))}
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[9rem] text-center text-sm font-medium capitalize">
            {format(month, "LLLL yyyy", { locale: ru })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setMonth((current) => addMonths(current, 1))}
            aria-label="Следующий месяц"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const today = new Date();
              setMonth(startOfMonth(today));
              setSelectedDay(today);
            }}
          >
            Сегодня
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            Ожидаемое прибытие
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Фактическое прибытие
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[18rem]">
            <div className="mb-2 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="py-1 text-center text-xs font-medium text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const dayKey = toDateKey(day);
                const dayEvents = eventsByDay.get(dayKey) ?? [];
                const inMonth = isSameMonth(day, month);
                const selected = isSameDay(day, selectedDay);
                const today = isToday(day);
                const hasExpected = dayEvents.some((event) => event.kind === "expected");
                const hasActual = dayEvents.some((event) => event.kind === "actual");

                return (
                  <button
                    key={dayKey}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "flex min-h-[4.5rem] flex-col rounded-lg border p-1.5 text-left transition-colors",
                      inMonth ? "bg-background" : "bg-muted/20 text-muted-foreground",
                      selected && "border-brand ring-1 ring-brand/30",
                      !selected && "hover:bg-muted/40",
                    )}
                  >
                    <span
                      className={cn(
                        "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                        today && "bg-brand text-brand-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>

                    {dayEvents.length > 0 && (
                      <div className="mt-auto space-y-1">
                        <div className="flex flex-wrap gap-0.5">
                          {hasExpected && (
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          )}
                          {hasActual && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          )}
                        </div>
                        <span className="block text-[10px] font-medium leading-none text-foreground">
                          {dayEvents.length} авто
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/10 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {format(selectedDay, "d MMMM yyyy", { locale: ru })}
            </h3>
            <Badge variant="outline">{selectedEvents.length}</Badge>
          </div>

          {selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">В этот день прибытий нет</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((event) => (
                <Link
                  key={`${event.dealId}-${event.kind}`}
                  href={`/deals/${event.dealId}`}
                  className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{event.clientName}</p>
                    <p className="truncate text-xs text-muted-foreground">{event.carLabel}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{event.vin}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge
                      variant="outline"
                      className={
                        event.kind === "actual"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                      }
                    >
                      {event.kind === "actual" ? "Факт" : "Ожидание"}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {STAGE_LABELS[event.currentStage]}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
