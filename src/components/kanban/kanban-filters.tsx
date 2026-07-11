"use client";

import { AlertTriangle, LayoutGrid, LayoutList, Plus, Search, UserCheck } from "lucide-react";
import { FormEvent, type ReactNode } from "react";
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
import { User } from "@/lib/types";
import { cn } from "@/lib/utils";

export const ALL_MANAGERS = "all";

interface KanbanFiltersProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isAdmin: boolean;
  managers: User[];
  selectedManagerId: string;
  onManagerChange: (managerId: string) => void;
  overdueOnly: boolean;
  onOverdueOnlyChange: (value: boolean) => void;
  withClientPortalOnly: boolean;
  onWithClientPortalOnlyChange: (value: boolean) => void;
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
  overdueOnly,
  onOverdueOnlyChange,
  withClientPortalOnly,
  onWithClientPortalOnlyChange,
  compactView,
  onCompactViewChange,
  canCreate,
  onDealCreated,
}: KanbanFiltersProps) {
  const activeFiltersCount =
    Number(overdueOnly) + Number(withClientPortalOnly) + Number(selectedManagerId !== ALL_MANAGERS);

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

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {isAdmin && managers.length > 0 && (
          <Select value={selectedManagerId} onValueChange={onManagerChange}>
            <SelectTrigger className="h-8 w-full sm:w-[220px]">
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

        <div className="flex flex-wrap items-center gap-2">
          <FilterToggle active={overdueOnly} onClick={() => onOverdueOnlyChange(!overdueOnly)}>
            <AlertTriangle className="h-3.5 w-3.5" />
            Просроченные
          </FilterToggle>

          <FilterToggle
            active={withClientPortalOnly}
            onClick={() => onWithClientPortalOnlyChange(!withClientPortalOnly)}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Личный кабинет
          </FilterToggle>

          <FilterToggle active={compactView} onClick={() => onCompactViewChange(!compactView)}>
            {compactView ? (
              <LayoutList className="h-3.5 w-3.5" />
            ) : (
              <LayoutGrid className="h-3.5 w-3.5" />
            )}
            Компактно
          </FilterToggle>

          {activeFiltersCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground"
              onClick={() => {
                onOverdueOnlyChange(false);
                onWithClientPortalOnlyChange(false);
                onManagerChange(ALL_MANAGERS);
              }}
            >
              Сбросить фильтры
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
