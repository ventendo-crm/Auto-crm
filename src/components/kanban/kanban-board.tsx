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
import { Plus, Search } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CreateDealDialog } from "@/components/deals/create-deal-dialog";
import { DealCard } from "@/components/kanban/deal-card";
import { KanbanColumn } from "@/components/kanban/kanban-column";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const ALL_MANAGERS = "all";

const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  return closestCorners(args);
};

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
  const [activeDeal, setActiveDeal] = useState<DealListItem | null>(null);
  const [overStage, setOverStage] = useState<DealStageType | null>(null);
  const [savingDealId, setSavingDealId] = useState<string | null>(null);

  const isAdmin = user?.role.name === "ADMIN";
  const canCreate = isAdmin || user?.role.name === "MANAGER";

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

  const loadDeals = useCallback(async (query: string, managerId: string) => {
    setLoading(true);
    try {
      const result = await api.deals.list({
        limit: 100,
        search: query || undefined,
        managerId: managerId !== ALL_MANAGERS ? managerId : undefined,
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
    void loadDeals(appliedSearch, selectedManagerId);
  }, [appliedSearch, loadDeals, selectedManagerId]);

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

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
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
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto p-3 sm:gap-4 sm:p-6">
        {STAGE_ORDER.map((stage) => (
          <Skeleton key={stage} className="h-[calc(100dvh-11rem)] w-[min(85vw,18rem)] shrink-0 snap-center rounded-xl sm:w-72 md:h-[calc(100vh-12rem)] md:w-80" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-col gap-3 border-b bg-card px-3 py-3 sm:px-6">
        {isAdmin && managers.length > 0 && (
          <Tabs value={selectedManagerId} onValueChange={setSelectedManagerId}>
            <div className="-mx-1 overflow-x-auto pb-1">
              <TabsList className="inline-flex h-auto w-max min-w-full justify-start gap-0.5 p-1 sm:min-w-0">
                <TabsTrigger value={ALL_MANAGERS}>Все менеджеры</TabsTrigger>
                {managers.map((manager) => (
                  <TabsTrigger key={manager.id} value={manager.id}>
                    {manager.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form
          onSubmit={handleSearchSubmit}
          className="flex w-full gap-2 sm:max-w-md"
        >
          <Input
            type="search"
            placeholder="Поиск по клиенту, VIN, марке..."
            className="w-full"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Button type="submit" variant="outline" size="sm" className="shrink-0">
            <Search className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Найти</span>
          </Button>
        </form>
        {canCreate && (
          <CreateDealDialog onCreated={() => loadDeals(appliedSearch, selectedManagerId)}>
            <Button variant="brand" size="sm" className="w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Новая сделка
            </Button>
          </CreateDealDialog>
        )}
        </div>
      </div>

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
            <DealCard deal={activeDeal} isOverlay canDrag={false} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
