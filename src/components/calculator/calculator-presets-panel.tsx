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
import { GripVertical, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CalculatorPresetInput } from "@/lib/validators/calculator-settings";
import { cn } from "@/lib/utils";

const PRESETS_OPEN_STORAGE_KEY = "autocrm-customs-calculator-presets-open";

interface CalculatorPresetsPanelProps {
  presets: CalculatorPresetInput[];
  saving?: boolean;
  onApply: (preset: CalculatorPresetInput) => void;
  onChange: (presets: CalculatorPresetInput[]) => void;
  onSaveCurrent: () => void;
}

function SortablePresetRow({
  preset,
  onApply,
  onRename,
  onDelete,
}: {
  preset: CalculatorPresetInput;
  onApply: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: preset.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-1 rounded-lg border bg-card pr-1",
        isDragging && "z-10 opacity-90 shadow-md",
      )}
    >
      <button
        type="button"
        className="flex h-9 w-8 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
        aria-label="Перетащить шаблон"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="min-w-0 flex-1 truncate px-1 py-2 text-left text-sm font-medium hover:text-brand"
        onClick={onApply}
      >
        {preset.name}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground"
        aria-label={`Переименовать ${preset.name}`}
        onClick={onRename}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={`Удалить ${preset.name}`}
        onClick={onDelete}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function loadPresetsOpen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(PRESETS_OPEN_STORAGE_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    // ignore
  }
  return true;
}

export function CalculatorPresetsPanel({
  presets,
  saving = false,
  onApply,
  onChange,
  onSaveCurrent,
}: CalculatorPresetsPanelProps) {
  const [open, setOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const renaming = presets.find((item) => item.id === renameId) ?? null;

  useEffect(() => {
    setOpen(loadPresetsOpen());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(PRESETS_OPEN_STORAGE_KEY, open ? "1" : "0");
    } catch {
      // ignore
    }
  }, [hydrated, open]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = presets.findIndex((item) => item.id === active.id);
    const newIndex = presets.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(presets, oldIndex, newIndex));
  };

  const handleRenameSave = () => {
    const name = renameValue.trim().slice(0, 60);
    if (!renameId || !name) return;
    onChange(
      presets.map((item) => (item.id === renameId ? { ...item, name } : item)),
    );
    setRenameId(null);
    setRenameValue("");
  };

  return (
    <div className="rounded-xl border bg-muted/10">
      <div className="flex items-start gap-2 px-4 py-3">
        <CollapsibleTrigger
          open={open}
          onToggle={() => setOpen((value) => !value)}
          className="min-w-0 flex-1 px-0 py-0"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Шаблоны</p>
              {presets.length > 0 && (
                <span className="rounded-md border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground tabular-nums">
                  {presets.length}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {open ? "Сохраняются в вашем аккаунте" : "Нажмите, чтобы развернуть"}
            </p>
          </div>
        </CollapsibleTrigger>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={saving}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onSaveCurrent();
          }}
        >
          Сохранить шаблон
        </Button>
      </div>

      <CollapsiblePanel open={open}>
        <div className="space-y-3 px-4 pb-4">
          {presets.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={presets.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {presets.map((preset) => (
                    <SortablePresetRow
                      key={preset.id}
                      preset={preset}
                      onApply={() => onApply(preset)}
                      onRename={() => {
                        setRenameId(preset.id);
                        setRenameValue(preset.name);
                      }}
                      onDelete={() => onChange(presets.filter((item) => item.id !== preset.id))}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <p className="text-xs text-muted-foreground">
              Сохраните текущие параметры расчёта — они будут доступны с любого устройства.
            </p>
          )}

          {presets.length > 0 && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => onChange([])}
              >
                Очистить все
              </Button>
            </div>
          )}
        </div>
      </CollapsiblePanel>

      <Dialog
        open={Boolean(renaming)}
        onOpenChange={(openDialog) => {
          if (!openDialog) {
            setRenameId(null);
            setRenameValue("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Переименовать шаблон</DialogTitle>
            <DialogDescription>Новое название сохранится в аккаунте.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rename-preset">Название</Label>
              <Input
                id="rename-preset"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value.slice(0, 60))}
                maxLength={60}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleRenameSave();
                  }
                }}
              />
            </div>
            <Button type="button" variant="brand" className="w-full" onClick={handleRenameSave}>
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
