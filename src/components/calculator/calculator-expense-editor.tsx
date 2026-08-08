"use client";

import { Loader2, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import {
  CalculatorExpenseItem,
  CalculatorExpenseOrigin,
  CALCULATOR_EXPENSE_CURRENCIES,
  CALCULATOR_EXPENSE_ROLES,
  createExpenseItemId,
  EXPENSE_ROLE_LABELS,
  getDefaultCompanyCalculatorExpenses,
} from "@/lib/customs-calculator/expense-template";
import { cn } from "@/lib/utils";

function cloneDefaults(): CalculatorExpenseItem[] {
  return getDefaultCompanyCalculatorExpenses().map((item) => ({ ...item }));
}

function cloneItems(items: CalculatorExpenseItem[]): CalculatorExpenseItem[] {
  return items.map((item) => ({ ...item }));
}

const COUNTRY_TABS: Array<{ value: CalculatorExpenseOrigin; label: string }> = [
  { value: "china", label: "Китай" },
  { value: "korea", label: "Корея" },
  { value: "kyrgyzstan", label: "Киргизия" },
  { value: "all", label: "Общие" },
];

function itemsForOrigin(
  items: CalculatorExpenseItem[],
  origin: CalculatorExpenseOrigin,
): CalculatorExpenseItem[] {
  return items
    .filter((item) => item.origin === origin)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function mergeOriginSlice(
  allItems: CalculatorExpenseItem[],
  origin: CalculatorExpenseOrigin,
  editedSlice: CalculatorExpenseItem[],
): CalculatorExpenseItem[] {
  const others = allItems.filter((item) => item.origin !== origin);
  const normalized = editedSlice.map((item) => ({ ...item, origin }));
  return [...others, ...normalized].sort((a, b) => a.sortOrder - b.sortOrder);
}

function defaultsForOrigin(origin: CalculatorExpenseOrigin): CalculatorExpenseItem[] {
  return cloneDefaults().filter((item) => item.origin === origin);
}

interface CalculatorExpenseEditorProps {
  /** Начальный список (если уже загружен в родителе). */
  initialItems?: CalculatorExpenseItem[];
  /** Стартовая страна фильтра (из калькулятора). */
  initialOrigin?: CalculatorExpenseOrigin;
  /** Компактный режим внутри калькулятора. */
  embedded?: boolean;
  onSaved?: (items: CalculatorExpenseItem[]) => void;
  onCancel?: () => void;
}

export function CalculatorExpenseEditor({
  initialItems,
  initialOrigin = "china",
  embedded = false,
  onSaved,
  onCancel,
}: CalculatorExpenseEditorProps) {
  const [items, setItems] = useState<CalculatorExpenseItem[]>(() =>
    initialItems ? cloneItems(initialItems) : cloneDefaults(),
  );
  const [selectedOrigin, setSelectedOrigin] = useState<CalculatorExpenseOrigin>(initialOrigin);
  const [loading, setLoading] = useState(!initialItems);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedOrigin(initialOrigin);
  }, [initialOrigin]);

  useEffect(() => {
    if (initialItems) {
      setItems(cloneItems(initialItems));
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void api.calculatorExpenseTemplate
      .get()
      .then((data) => {
        if (!cancelled) setItems(cloneItems(data.expenseItems));
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Не удалось загрузить шаблон");
          setItems(cloneDefaults());
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialItems]);

  const visibleItems = useMemo(
    () => itemsForOrigin(items, selectedOrigin),
    [items, selectedOrigin],
  );

  const updateItem = (id: string, patch: Partial<CalculatorExpenseItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const addItem = () => {
    const nextOrder = items.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 10;
    setItems((current) => [
      ...current,
      {
        id: createExpenseItemId(),
        label: "Новый расход",
        defaultAmount: 0,
        currency: "RUB",
        origin: selectedOrigin,
        role: "extra",
        sortOrder: nextOrder,
      },
    ]);
  };

  const handleSave = async () => {
    if (visibleItems.some((item) => !item.label.trim())) {
      toast.error("У всех пунктов должно быть название");
      return;
    }
    setSaving(true);
    try {
      const payload = mergeOriginSlice(items, selectedOrigin, visibleItems);
      const saved = await api.calculatorExpenseTemplate.save(payload);
      const next = cloneItems(saved.expenseItems);
      setItems(next);
      toast.success(
        `Шаблон расходов сохранён (${COUNTRY_TABS.find((tab) => tab.value === selectedOrigin)?.label ?? selectedOrigin})`,
      );
      onSaved?.(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setItems((current) =>
      mergeOriginSlice(current, selectedOrigin, defaultsForOrigin(selectedOrigin)),
    );
    toast.message(
      `Восстановлены стандартные пункты для «${COUNTRY_TABS.find((tab) => tab.value === selectedOrigin)?.label}» — нажмите «Сохранить»`,
    );
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Загрузка шаблона…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Страна для настройки</Label>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {COUNTRY_TABS.map((tab) => {
            const active = selectedOrigin === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setSelectedOrigin(tab.value)}
                className={cn(
                  "shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-brand bg-brand-muted text-brand"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/50",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Редактируете только поля выбранной страны. Остальные страны при сохранении не меняются.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Добавить поле
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Сбросить
        </Button>
        <Button
          type="button"
          variant="brand"
          size="sm"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-3.5 w-3.5" />
          )}
          Сохранить
        </Button>
        {embedded && onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Отмена
          </Button>
        )}
      </div>

      {!embedded && (
        <p className="text-xs text-muted-foreground">
          У каждой строки можно менять название, сумму, валюту и роль. Роль «Доп. расход» просто
          входит в итог; системные роли влияют на ВТБ и инвойс Кореи.
        </p>
      )}

      {visibleItems.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Нет полей для этой страны. Добавьте свои или сбросьте к стандартным.
        </p>
      ) : (
        visibleItems.map((item) => (
          <div
            key={item.id}
            className={
              embedded
                ? "grid gap-2 rounded-xl border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_minmax(0,1fr)_auto]"
                : "grid gap-3 rounded-xl border bg-muted/10 p-3 sm:grid-cols-[minmax(0,1.4fr)_7rem_6.5rem_minmax(0,1.2fr)_auto]"
            }
          >
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Название</Label>
              <Input
                value={item.label}
                onChange={(event) => updateItem(item.id, { label: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Сумма</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={Number.isFinite(item.defaultAmount) ? item.defaultAmount : 0}
                onChange={(event) =>
                  updateItem(item.id, {
                    defaultAmount: Math.max(0, Number(event.target.value) || 0),
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Валюта</Label>
              <Select
                value={item.currency}
                onValueChange={(value) =>
                  updateItem(item.id, {
                    currency: value as CalculatorExpenseItem["currency"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALCULATOR_EXPENSE_CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Роль в расчёте</Label>
              <Select
                value={item.role}
                onValueChange={(value) =>
                  updateItem(item.id, {
                    role: value as CalculatorExpenseItem["role"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALCULATOR_EXPENSE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {EXPENSE_ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => removeItem(item.id)}
                aria-label="Удалить поле"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
