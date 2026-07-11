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
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DealCard } from "@/components/kanban/deal-card";
import { ALL_MANAGERS, KanbanFilters } from "@/components/kanban/kanban-filters";
import { KanbanColumn } from "@/components/kanban/kanban-column";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useIsAndroidWebView } from "@/hooks/use-is-android-webview";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { api } from "@/lib/api-client";
import { androidBridge } from "@/lib/android-webview";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/constants";
import {
  canDragDeal,
  resolveDragEndStage,
  resolveDragOverStage,
} from "@/lib/kanban-utils";
import { DealListItem, User } from "@/lib/types";
import { cn } from "@/lib/utils";

const COMPACT_VIEW_STORAGE_KEY = "kanban-compact-view";

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
}

export function KanbanBoard() {
  const { user } = useAuth();
  const isAndroidApp = useIsAndroidWebView();
  const isMobile = useIsMobile();
  const dragEnabled = !isMobile;
  const [deals, setDeals] = useState<DealListItem[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedManagerId, setSelectedManagerId] = useState(ALL_MANAGERS);
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
  }, []);

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

  const currentQuery = useMemo<KanbanQuery>(
    () => ({
      search: appliedSearch,
      managerId: selectedManagerId,
    }),
    [appliedSearch, selectedManagerId],
  );

  const loadDeals = useCallback(async (query: KanbanQuery) => {
    setLoading(true);
    try {
      const result = await api.deals.list({
        limit: 100,
        search: query.search || undefined,
        managerId: query.managerId !== ALL_MANAGERS ? query.managerId : undefined,
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
    void loadDeals(currentQuery);
  }, [currentQuery, loadDeals]);

  useEffect(() => {
    if (!isAndroidApp) return;

    androidBridge.setPullToRefreshEnabled(false);
    return () => androidBridge.setPullToRefreshEnabled(true);
  }, [isAndroidApp]);

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

    const fromLabel = STAGE_LABELS[deal.currentStage];
    const toLabel = STAGE_LABELS[toStage];
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
        <div className="border-b bg-card px-3 py-3 sm:px-6">
          <Skeleton className="h-9 w-full max-w-md" />
          <Skeleton className="mt-3 h-8 w-full max-w-xl" />
        </div>
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto p-3 sm:gap-4 sm:p-6">
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
          className={cn(
            "flex flex-1 snap-x snap-mandatory gap-3 overflow-x-auto p-3 sm:gap-4 sm:p-6",
            isAndroidApp && "kanban-android-scroll",
          )}
          onTouchStart={isAndroidApp ? lockHorizontalGesture : undefined}
          onTouchEnd={isAndroidApp ? releaseHorizontalGesture : undefined}
          onTouchCancel={isAndroidApp ? releaseHorizontalGesture : undefined}
        >
          {STAGE_ORDER.map((stage) => (
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
          ))}
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
