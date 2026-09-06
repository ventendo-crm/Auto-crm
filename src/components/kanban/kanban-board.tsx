"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
} from "@dnd-kit/core";
import { DealStageType } from "@prisma/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DealCard } from "@/components/kanban/deal-card";
import { ALL_MANAGERS, ALL_ORIGINS, KanbanFilters } from "@/components/kanban/kanban-filters";
import { KanbanColumn } from "@/components/kanban/kanban-column";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useCompanyWorkspace } from "@/hooks/use-company-workspace";
import { useIsAndroidWebView } from "@/hooks/use-is-android-webview";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { api } from "@/lib/api-client";
import { androidBridge } from "@/lib/android-webview";
import { STAGE_ORDER } from "@/lib/constants";
import {
  canDragDeal,
  resolveDragEndStage,
  resolveDragOverStage,
} from "@/lib/kanban-utils";
import { DealListItem, User } from "@/lib/types";
import { cn } from "@/lib/utils";

const COMPACT_VIEW_STORAGE_KEY = "kanban-compact-view";
const KANBAN_SCROLL_STORAGE_KEY = "kanban-scroll-left";
const KANBAN_FILTERS_STORAGE_KEY = "kanban-filters";

type KanbanFiltersState = {
  searchInput: string;
  appliedSearch: string;
  selectedManagerId: string;
  selectedOriginId: string;
};

function readKanbanFilters(): KanbanFiltersState | null {
  try {
    const raw = sessionStorage.getItem(KANBAN_FILTERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<KanbanFiltersState>;
    return {
      searchInput: typeof parsed.searchInput === "string" ? parsed.searchInput : "",
      appliedSearch: typeof parsed.appliedSearch === "string" ? parsed.appliedSearch : "",
      selectedManagerId:
        typeof parsed.selectedManagerId === "string" ? parsed.selectedManagerId : ALL_MANAGERS,
      selectedOriginId:
        typeof parsed.selectedOriginId === "string" ? parsed.selectedOriginId : ALL_ORIGINS,
    };
  } catch {
    return null;
  }
}

function readKanbanScrollLeft(): number {
  try {
    const raw = sessionStorage.getItem(KANBAN_SCROLL_STORAGE_KEY);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeKanbanScrollLeft(value: number) {
  try {
    sessionStorage.setItem(KANBAN_SCROLL_STORAGE_KEY, String(Math.max(0, Math.round(value))));
  } catch {
    // sessionStorage недоступен
  }
}

const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  return closestCorners(args);
};

interface KanbanQuery {
  search: string;
  managerId: string;
  destinationCountry: string;
}

export function KanbanBoard() {
  const { user } = useAuth();
  const { stageLabel } = useCompanyWorkspace();
  const isAndroidApp = useIsAndroidWebView();
  const isMobile = useIsMobile();
  const dragEnabled = !isMobile;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [deals, setDeals] = useState<DealListItem[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtersReady, setFiltersReady] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedManagerId, setSelectedManagerId] = useState(ALL_MANAGERS);
  const [selectedOriginId, setSelectedOriginId] = useState(ALL_ORIGINS);
  const [compactView, setCompactView] = useState(false);
  const [activeDeal, setActiveDeal] = useState<DealListItem | null>(null);
  const [overStage, setOverStage] = useState<DealStageType | null>(null);
  const [savingDealId, setSavingDealId] = useState<string | null>(null);

  const isAdmin = user?.role.name === "ADMIN";
  const canCreate = isAdmin || user?.role.name === "MANAGER";

  useEffect(() => {
    try {
      setCompactView(localStorage.getItem(COMPACT_VIEW_STORAGE_KEY) === "true");
    } catch {
      // localStorage недоступен
    }

    const savedFilters = readKanbanFilters();
    if (savedFilters) {
      setSearchInput(savedFilters.searchInput);
      setAppliedSearch(savedFilters.appliedSearch);
      setSelectedManagerId(savedFilters.selectedManagerId);
      setSelectedOriginId(savedFilters.selectedOriginId);
    }
    setFiltersReady(true);
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    try {
      const payload: KanbanFiltersState = {
        searchInput,
        appliedSearch,
        selectedManagerId,
        selectedOriginId,
      };
      sessionStorage.setItem(KANBAN_FILTERS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // sessionStorage недоступен
    }
  }, [filtersReady, searchInput, appliedSearch, selectedManagerId, selectedOriginId]);

  const handleCompactViewChange = useCallback((value: boolean) => {
    setCompactView(value);
    try {
      localStorage.setItem(COMPACT_VIEW_STORAGE_KEY, String(value));
    } catch {
      // localStorage недоступен
    }
  }, []);

  const dealsByStage = useMemo(() => {
    const map = Object.fromEntries(STAGE_ORDER.map((stage) => [stage, [] as DealListItem[]])) as Record<
      DealStageType,
      DealListItem[]
    >;

    for (const deal of deals) {
      map[deal.currentStage].push(deal);
    }

    return map;
  }, [deals]);

  const isSearchActive = appliedSearch.trim().length > 0;

  const visibleStages = useMemo(() => {
    if (!isSearchActive) return STAGE_ORDER;
    return STAGE_ORDER.filter((stage) => dealsByStage[stage].length > 0);
  }, [dealsByStage, isSearchActive]);

  const currentQuery = useMemo<KanbanQuery>(
    () => ({
      search: appliedSearch,
      managerId: selectedManagerId,
      destinationCountry: selectedOriginId,
    }),
    [appliedSearch, selectedManagerId, selectedOriginId],
  );

  const loadDeals = useCallback(async (query: KanbanQuery) => {
    setLoading(true);
    try {
      const result = await api.deals.list({
        limit: 100,
        search: query.search || undefined,
        managerId: query.managerId !== ALL_MANAGERS ? query.managerId : undefined,
        destinationCountry:
          query.destinationCountry !== ALL_ORIGINS ? query.destinationCountry : undefined,
      });
      setDeals(result.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить сделки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    void api.users
      .list()
      .then((users) => setManagers(users.filter((item) => item.role.name === "MANAGER")))
      .catch(() => {
        // фильтр менеджеров не критичен для канбана
      });
  }, [isAdmin]);

  useEffect(() => {
    if (!filtersReady) return;
    void loadDeals(currentQuery);
  }, [currentQuery, loadDeals, filtersReady]);

  useEffect(() => {
    if (loading || !filtersReady) return;
    const el = scrollRef.current;
    if (!el) return;

    if (isSearchActive) {
      el.scrollLeft = 0;
      writeKanbanScrollLeft(0);
      return;
    }

    const left = readKanbanScrollLeft();
    if (left <= 0) return;
    const restore = () => {
      el.scrollLeft = left;
    };
    restore();
    const frame = window.requestAnimationFrame(restore);
    return () => window.cancelAnimationFrame(frame);
  }, [loading, filtersReady, deals.length, compactView, isSearchActive]);

  const handleBoardScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    writeKanbanScrollLeft(el.scrollLeft);
  };

  useEffect(() => {
    if (!isAndroidApp) return;

    androidBridge.setPullToRefreshEnabled(false);
    return () => androidBridge.setPullToRefreshEnabled(true);
  }, [isAndroidApp]);

  useEffect(() => {
    const persistScroll = () => {
      if (scrollRef.current) {
        writeKanbanScrollLeft(scrollRef.current.scrollLeft);
      }
    };
    window.addEventListener("pagehide", persistScroll);
    document.addEventListener("visibilitychange", persistScroll);
    return () => {
      window.removeEventListener("pagehide", persistScroll);
      document.removeEventListener("visibilitychange", persistScroll);
    };
  }, []);

  const releaseHorizontalGesture = useCallback(() => {
    androidBridge.setHorizontalGestureLock(false);
  }, []);

  const lockHorizontalGesture = useCallback(() => {
    androidBridge.setHorizontalGestureLock(true);
  }, []);

  const applySearch = useCallback(() => {
    setAppliedSearch(searchInput.trim());
  }, [searchInput]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applySearch();
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isAndroidApp ? { distance: 16, tolerance: 8 } : { distance: 6 },
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals.find((d) => d.id === event.active.id);
    setActiveDeal(deal ?? null);
    setOverStage(deal?.currentStage ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverStage(resolveDragOverStage(event, deals));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDeal(null);
    setOverStage(null);

    const dealId = String(event.active.id);
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;

    if (!canDragDeal(user?.role.name, user?.id, deal.managerIds)) {
      toast.error("Нет прав для перемещения этой сделки");
      return;
    }

    const toStage = resolveDragEndStage(event, deals);
    if (!toStage || deal.currentStage === toStage) return;

    const fromLabel = stageLabel(deal.currentStage);
    const toLabel = stageLabel(toStage);
    const previousStage = deal.currentStage;

    setSavingDealId(dealId);
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? { ...d, currentStage: toStage, stageEnteredAt: new Date().toISOString() }
          : d,
      ),
    );

    try {
      await api.deals.changeStage(dealId, toStage);
      toast.success(`${deal.clientName}: ${fromLabel} → ${toLabel}`, {
        description: "Этап обновлён, история и уведомление созданы",
      });
    } catch (err) {
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, currentStage: previousStage } : d)),
      );
      toast.error(err instanceof Error ? err.message : "Не удалось изменить этап");
    } finally {
      setSavingDealId(null);
    }
  };

  const handleDragCancel = () => {
    setActiveDeal(null);
    setOverStage(null);
  };

  if (loading && deals.length === 0) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b bg-card px-4 py-3 sm:px-6">
          <Skeleton className="h-9 w-full max-w-md" />
          <Skeleton className="mt-3 h-8 w-full max-w-xl" />
        </div>
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto p-4 sm:gap-4 sm:p-6">
          {STAGE_ORDER.map((stage) => (
            <Skeleton
              key={stage}
              className={cn(
                "h-[calc(100dvh-13rem)] shrink-0 snap-center rounded-xl",
                compactView ? "w-56 md:w-60" : "w-[min(85vw,18rem)] sm:w-72 md:h-[calc(100vh-13rem)] md:w-80",
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <KanbanFilters
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onSearchSubmit={handleSearchSubmit}
        isAdmin={isAdmin}
        managers={managers}
        selectedManagerId={selectedManagerId}
        onManagerChange={setSelectedManagerId}
        selectedOriginId={selectedOriginId}
        onOriginChange={setSelectedOriginId}
        compactView={compactView}
        onCompactViewChange={handleCompactViewChange}
        canCreate={canCreate}
        onDealCreated={() => loadDeals(currentQuery)}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          ref={scrollRef}
          className={cn(
            "flex flex-1 snap-x snap-mandatory gap-3 overflow-x-auto p-4 sm:gap-4 sm:p-6",
            isAndroidApp && "kanban-android-scroll",
          )}
          onScroll={handleBoardScroll}
          onTouchStart={isAndroidApp ? lockHorizontalGesture : undefined}
          onTouchEnd={isAndroidApp ? releaseHorizontalGesture : undefined}
          onTouchCancel={isAndroidApp ? releaseHorizontalGesture : undefined}
        >
          {isSearchActive && visibleStages.length === 0 ? (
            <div className="flex min-h-[12rem] w-full items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-center text-sm text-muted-foreground">
              По запросу «{appliedSearch.trim()}» ничего не найдено
            </div>
          ) : (
            visibleStages.map((stage) => (
              <KanbanColumn
                key={stage}
                stage={stage}
                deals={dealsByStage[stage]}
                compact={compactView}
                isOver={overStage === stage}
                dragEnabled={dragEnabled}
                canDrag={(deal) =>
                  dragEnabled && canDragDeal(user?.role.name, user?.id, deal.managerIds)
                }
                savingDealId={savingDealId}
              />
            ))
          )}
        </div>

        <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
          {activeDeal ? (
            <DealCard deal={activeDeal} compact={compactView} isOverlay canDrag={false} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
