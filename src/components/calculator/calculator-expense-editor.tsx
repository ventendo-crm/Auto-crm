"use client";

import { Loader2, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
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
  CALCULATOR_EXPENSE_CURRENCIES,
  CALCULATOR_EXPENSE_ORIGINS,
  CALCULATOR_EXPENSE_ROLES,
  createExpenseItemId,
  EXPENSE_ORIGIN_LABELS,
  EXPENSE_ROLE_LABELS,
  getDefaultCompanyCalculatorExpenses,
} from "@/lib/customs-calculator/expense-template";

function cloneDefaults(): CalculatorExpenseItem[] {
  return getDefaultCompanyCalculatorExpenses().map((item) => ({ ...item }));
}

function cloneItems(items: CalculatorExpenseItem[]): CalculatorExpenseItem[] {
  return items.map((item) => ({ ...item }));
}

interface CalculatorExpenseEditorProps {
  /** Начальный список (если уже загружен в родителе). */
  initialItems?: CalculatorExpenseItem[];
  /** Компактный режим внутри калькулятора. */
  embedded?: boolean;
  onSaved?: (items: CalculatorExpenseItem[]) => void;
  onCancel?: () => void;
}

export function CalculatorExpenseEditor({
  initialItems,
  embedded = false,
  onSaved,
  onCancel,
}: CalculatorExpenseEditorProps) {
  const [items, setItems] = useState<CalculatorExpenseItem[]>(() =>
    initialItems ? cloneItems(initialItems) : cloneDefaults(),
  );
  const [loading, setLoading] = useState(!initialItems);
  const [saving, setSaving] = useState(false);

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
        origin: "all",
        role: "extra",
        sortOrder: nextOrder,
      },
    ]);
  };

  const handleSave = async () => {
    if (items.some((item) => !item.label.trim())) {
      toast.error("У всех пунктов должно быть название");
      return;
    }
    setSaving(true);
    try {
      const saved = await api.calculatorExpenseTemplate.save(items);
      const next = cloneItems(saved.expenseItems);
      setItems(next);
      toast.success("Шаблон расходов сохранён");
      onSaved?.(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setItems(cloneDefaults());
    toast.message("Восстановлены стандартные пункты — нажмите «Сохранить»");
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
          Добавляйте и удаляйте пункты расходов. Роль «Доп. расход» просто входит в итог; системные
          роли влияют на ВТБ и инвойс Кореи.
        </p>
      )}

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Нет полей. Добавьте свои или сбросьте к стандартным.
        </p>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className={
              embedded
                ? "grid gap-2 rounded-xl border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_auto]"
                : "grid gap-3 rounded-xl border bg-muted/10 p-3 sm:grid-cols-[minmax(0,1.4fr)_7rem_6.5rem_minmax(0,1fr)_minmax(0,1.2fr)_auto]"
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

            {!embedded && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Страна</Label>
                  <Select
                    value={item.origin}
                    onValueChange={(value) =>
                      updateItem(item.id, {
                        origin: value as CalculatorExpenseItem["origin"],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CALCULATOR_EXPENSE_ORIGINS.map((origin) => (
                        <SelectItem key={origin} value={origin}>
                          {EXPENSE_ORIGIN_LABELS[origin]}
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
              </>
            )}

            {embedded && (
              <div className="space-y-1.5 sm:col-span-3">
                <Label className="text-xs text-muted-foreground">Страна / роль</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select
                    value={item.origin}
                    onValueChange={(value) =>
                      updateItem(item.id, {
                        origin: value as CalculatorExpenseItem["origin"],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CALCULATOR_EXPENSE_ORIGINS.map((origin) => (
                        <SelectItem key={origin} value={origin}>
                          {EXPENSE_ORIGIN_LABELS[origin]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              </div>
            )}

            <div className={embedded ? "flex items-end sm:col-start-4 sm:row-start-1" : "flex items-end"}>
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
