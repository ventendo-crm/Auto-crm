"use client";

import { LayoutGrid, LayoutList, Plus, Search } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { CreateDealDialog } from "@/components/deals/create-deal-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import {
  buildOriginOptions,
  type CustomCalculatorOrigin,
} from "@/lib/customs-calculator/custom-origins";
import { User } from "@/lib/types";
import { cn } from "@/lib/utils";

export const ALL_MANAGERS = "all";
export const ALL_ORIGINS = "all";

interface KanbanFiltersProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isAdmin: boolean;
  managers: User[];
  selectedManagerId: string;
  onManagerChange: (managerId: string) => void;
  selectedOriginId: string;
  onOriginChange: (originId: string) => void;
  compactView: boolean;
  onCompactViewChange: (value: boolean) => void;
  canCreate: boolean;
  onDealCreated: () => void;
}

function FilterToggle({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn(
        "h-8 shrink-0 gap-1.5",
        active && "border-brand/40 bg-brand-muted/50 text-foreground shadow-sm",
        className,
      )}
    >
      {children}
    </Button>
  );
}

export function KanbanFilters({
  searchInput,
  onSearchInputChange,
  onSearchSubmit,
  isAdmin,
  managers,
  selectedManagerId,
  onManagerChange,
  selectedOriginId,
  onOriginChange,
  compactView,
  onCompactViewChange,
  canCreate,
  onDealCreated,
}: KanbanFiltersProps) {
  const [customOrigins, setCustomOrigins] = useState<CustomCalculatorOrigin[]>([]);

  useEffect(() => {
    let cancelled = false;
    void api.calculatorExpenseTemplate
      .get()
      .then((settings) => {
        if (!cancelled) setCustomOrigins(settings.customOrigins ?? []);
      })
      .catch(() => {
        if (!cancelled) setCustomOrigins([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const originOptions = useMemo(() => buildOriginOptions(customOrigins), [customOrigins]);

  const hasManagerFilter = isAdmin && selectedManagerId !== ALL_MANAGERS;
  const hasOriginFilter = selectedOriginId !== ALL_ORIGINS;
  const hasActiveFilters = hasManagerFilter || hasOriginFilter;
  const showManagerSelect = isAdmin && managers.length > 0;

  const resetFilters = () => {
    if (hasManagerFilter) onManagerChange(ALL_MANAGERS);
    if (hasOriginFilter) onOriginChange(ALL_ORIGINS);
  };

  return (
    <div className="flex flex-col gap-3 border-b bg-card px-3 py-3 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form onSubmit={onSearchSubmit} className="flex w-full gap-2 lg:max-w-md">
          <Input
            type="search"
            placeholder="Поиск по клиенту, VIN, марке..."
            className="w-full"
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
          />
          <Button type="submit" variant="outline" size="sm" className="shrink-0">
            <Search className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Найти</span>
          </Button>
        </form>

        {canCreate && (
          <CreateDealDialog onCreated={onDealCreated}>
            <Button variant="brand" size="sm" className="w-full lg:w-auto">
              <Plus className="h-4 w-4" />
              Новая сделка
            </Button>
          </CreateDealDialog>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {showManagerSelect && (
            <Select value={selectedManagerId} onValueChange={onManagerChange}>
              <SelectTrigger className="h-8 min-w-0 flex-1 sm:w-[200px] sm:flex-none">
                <SelectValue placeholder="Менеджер" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_MANAGERS}>Все менеджеры</SelectItem>
                {managers.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id}>
                    {manager.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={selectedOriginId} onValueChange={onOriginChange}>
            <SelectTrigger className="h-8 min-w-0 flex-1 sm:w-[200px] sm:flex-none">
              <SelectValue placeholder="Страна экспорта" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ORIGINS}>Все страны</SelectItem>
              {originOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <FilterToggle
            active={compactView}
            onClick={() => onCompactViewChange(!compactView)}
            className="shrink-0"
          >
            {compactView ? (
              <LayoutList className="h-3.5 w-3.5" />
            ) : (
              <LayoutGrid className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Компактно</span>
          </FilterToggle>
        </div>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 self-start px-2 text-xs text-muted-foreground"
            onClick={resetFilters}
          >
            Сбросить фильтры
          </Button>
        )}
      </div>
    </div>
  );
}
