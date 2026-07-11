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
import { STAGE_COLORS, STAGE_LABELS } from "@/lib/constants";
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
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-brand" />
            Календарь таможни
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {monthEventsCount > 0
              ? `${monthEventsCount} сделок в этом месяце`
              : "В этом месяце дат таможни нет"}
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setMonth((current) => subMonths(current, 1))}
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-0 flex-1 text-center text-sm font-medium capitalize sm:min-w-[9rem] sm:flex-none">
            {format(month, "LLLL yyyy", { locale: ru })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setMonth((current) => addMonths(current, 1))}
            aria-label="Следующий месяц"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full sm:w-auto"
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

      <CardContent className="space-y-4 overflow-hidden">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            Дата таможни из логистики
          </span>
        </div>

        <div className="w-full min-w-0">
          <div className="mb-1 grid grid-cols-7 gap-0.5 sm:mb-2 sm:gap-1">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="min-w-0 truncate py-1 text-center text-micro font-medium text-muted-foreground sm:text-xs"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {calendarDays.map((day) => {
              const dayKey = toDateKey(day);
              const dayEvents = eventsByDay.get(dayKey) ?? [];
              const inMonth = isSameMonth(day, month);
              const selected = isSameDay(day, selectedDay);
              const today = isToday(day);

              return (
                <button
                  key={dayKey}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "box-border flex min-h-[3.25rem] min-w-0 flex-col items-center rounded-md border p-0.5 text-center transition-colors duration-normal sm:min-h-[4.5rem] sm:items-start sm:rounded-lg sm:p-1.5 sm:text-left",
                    inMonth ? "bg-background" : "bg-muted/20 text-muted-foreground",
                    selected && "border-brand ring-1 ring-inset ring-brand/30",
                    !selected && "hover:bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium sm:mb-1 sm:h-6 sm:w-6 sm:text-xs",
                      today && "bg-brand text-brand-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>

                  {dayEvents.length > 0 && (
                    <div className="mt-auto flex min-w-0 flex-col items-center gap-0.5 sm:items-start sm:space-y-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      <span className="hidden max-w-full truncate text-micro font-medium leading-none text-foreground sm:block">
                        {dayEvents.length} авто
                      </span>
                      <span className="sr-only sm:hidden">{dayEvents.length} авто</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="surface-muted p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-section-title">
              {format(selectedDay, "d MMMM yyyy", { locale: ru })}
            </h3>
            <Badge variant="outline">{selectedEvents.length}</Badge>
          </div>

          {selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">В этот день таможни нет</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((event) => (
                <Link
                  key={`${event.dealId}-${event.kind}`}
                  href={`/deals/${event.dealId}`}
                  className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3 transition-colors duration-normal hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{event.clientName}</p>
                    <p className="truncate text-xs text-muted-foreground">{event.carLabel}</p>
                    <p className="font-mono text-micro text-muted-foreground">{event.vin}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="outline" className={STAGE_COLORS[event.currentStage]}>
                      Таможня
                    </Badge>
                    <span className="text-micro text-muted-foreground">
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
