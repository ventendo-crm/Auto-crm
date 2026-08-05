"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, RotateCcw, Save, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DASHBOARD_WIDGET_LABELS,
  getDefaultDashboardLayout,
  sortDashboardLayout,
  type DashboardLayoutItem,
  type DashboardWidgetId,
} from "@/lib/dashboard/widgets";
import { cn } from "@/lib/utils";

function SortableLayoutRow({
  item,
  onToggle,
}: {
  item: DashboardLayoutItem;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card px-2 py-2",
        !item.enabled && "opacity-60",
        isDragging && "z-10 opacity-90 shadow-md",
      )}
    >
      <button
        type="button"
        className="flex h-9 w-8 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
        aria-label="Перетащить блок"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <p className="min-w-0 flex-1 truncate text-sm font-medium">
        {DASHBOARD_WIDGET_LABELS[item.id]}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground"
        aria-label={item.enabled ? "Скрыть блок" : "Показать блок"}
        onClick={onToggle}
      >
        {item.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export function DashboardLayoutEditor({
  initialLayout,
  saving,
  onSave,
  onCancel,
}: {
  initialLayout: DashboardLayoutItem[];
  saving?: boolean;
  onSave: (layout: DashboardLayoutItem[]) => void;
  onCancel: () => void;
}) {
  const [items, setItems] = useState(() => sortDashboardLayout(initialLayout));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setItems(sortDashboardLayout(arrayMove(items, oldIndex, newIndex)));
  };

  const toggle = (id: DashboardWidgetId) => {
    setItems((current) =>
      sortDashboardLayout(
        current.map((item) =>
          item.id === id ? { ...item, enabled: !item.enabled } : item,
        ),
      ),
    );
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Настройка дашборда</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Перетащите блоки и включите или скрывайте их. Изменения для всей компании.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setItems(getDefaultDashboardLayout())}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Сбросить
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Отмена
          </Button>
          <Button
            type="button"
            variant="brand"
            size="sm"
            disabled={saving}
            onClick={() => onSave(sortDashboardLayout(items))}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Сохранить
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((item) => (
              <SortableLayoutRow key={item.id} item={item} onToggle={() => toggle(item.id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
