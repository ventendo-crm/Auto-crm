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
  type CustomCalculatorOrigin,
  isCustomOriginId,
} from "@/lib/customs-calculator/custom-origins";
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

const SYSTEM_COUNTRY_TABS: Array<{ value: CalculatorExpenseOrigin; label: string }> = [
  { value: "china", label: "Китай" },
  { value: "korea", label: "Корея" },
  { value: "kyrgyzstan", label: "Киргизия" },
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

function tabLabel(
  origin: CalculatorExpenseOrigin,
  customOrigins: CustomCalculatorOrigin[],
): string {
  const system = SYSTEM_COUNTRY_TABS.find((tab) => tab.value === origin);
  if (system) return system.label;
  if (origin === "all") return "Общие";
  return customOrigins.find((item) => item.id === origin)?.label ?? origin;
}

interface CalculatorExpenseEditorProps {
  /** Начальный список (если уже загружен в родителе). */
  initialItems?: CalculatorExpenseItem[];
  /** Кастомные страны компании (если уже загружены). */
  initialCustomOrigins?: CustomCalculatorOrigin[];
  /** Стартовая страна фильтра (из калькулятора). */
  initialOrigin?: CalculatorExpenseOrigin;
  /** Компактный режим внутри калькулятора. */
  embedded?: boolean;
  onSaved?: (items: CalculatorExpenseItem[], customOrigins: CustomCalculatorOrigin[]) => void;
  onCancel?: () => void;
}

export function CalculatorExpenseEditor({
  initialItems,
  initialCustomOrigins,
  initialOrigin = "china",
  embedded = false,
  onSaved,
  onCancel,
}: CalculatorExpenseEditorProps) {
  const [items, setItems] = useState<CalculatorExpenseItem[]>(() =>
    initialItems ? cloneItems(initialItems) : cloneDefaults(),
  );
  const [customOrigins, setCustomOrigins] = useState<CustomCalculatorOrigin[]>(
    () => initialCustomOrigins ?? [],
  );
  const [selectedOrigin, setSelectedOrigin] = useState<CalculatorExpenseOrigin>(initialOrigin);
  const [loading, setLoading] = useState(!initialItems);
  const [saving, setSaving] = useState(false);
  const [addingCountry, setAddingCountry] = useState(false);
  const [newCountryLabel, setNewCountryLabel] = useState("");
  const [newCountryCurrency, setNewCountryCurrency] =
    useState<CalculatorExpenseItem["currency"]>("CNY");
  const [originBusy, setOriginBusy] = useState(false);

  useEffect(() => {
    setSelectedOrigin(initialOrigin);
  }, [initialOrigin]);

  useEffect(() => {
    if (initialCustomOrigins) {
      setCustomOrigins(initialCustomOrigins);
    }
  }, [initialCustomOrigins]);

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
        if (!cancelled) {
          setItems(cloneItems(data.expenseItems));
          setCustomOrigins(data.customOrigins ?? []);
        }
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

  const countryTabs = useMemo(
    () => [
      ...SYSTEM_COUNTRY_TABS,
      ...customOrigins.map((origin) => ({ value: origin.id, label: origin.label })),
      { value: "all" as const, label: "Общие" },
    ],
    [customOrigins],
  );

  const visibleItems = useMemo(
    () => itemsForOrigin(items, selectedOrigin),
    [items, selectedOrigin],
  );

  const selectedIsCustom = isCustomOriginId(String(selectedOrigin));

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
      const saved = await api.calculatorExpenseTemplate.save(payload, customOrigins);
      const nextItems = cloneItems(saved.expenseItems);
      const nextOrigins = saved.customOrigins ?? [];
      setItems(nextItems);
      setCustomOrigins(nextOrigins);
      toast.success(
        `Шаблон расходов сохранён (${tabLabel(selectedOrigin, nextOrigins)})`,
      );
      onSaved?.(nextItems, nextOrigins);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (selectedIsCustom) {
      setItems((current) => mergeOriginSlice(current, selectedOrigin, []));
      toast.message(
        `Поля «${tabLabel(selectedOrigin, customOrigins)}» очищены — нажмите «Сохранить»`,
      );
      return;
    }
    setItems((current) =>
      mergeOriginSlice(current, selectedOrigin, defaultsForOrigin(selectedOrigin)),
    );
    toast.message(
      `Восстановлены стандартные пункты для «${tabLabel(selectedOrigin, customOrigins)}» — нажмите «Сохранить»`,
    );
  };

  const handleAddCountry = async () => {
    const label = newCountryLabel.trim();
    if (!label) {
      toast.error("Укажите название страны");
      return;
    }
    setOriginBusy(true);
    try {
      const saved = await api.calculatorExpenseTemplate.addOrigin(label, newCountryCurrency);
      const nextItems = cloneItems(saved.expenseItems);
      const nextOrigins = saved.customOrigins ?? [];
      setItems(nextItems);
      setCustomOrigins(nextOrigins);
      const created = nextOrigins[nextOrigins.length - 1];
      if (created) setSelectedOrigin(created.id);
      setNewCountryLabel("");
      setNewCountryCurrency("CNY");
      setAddingCountry(false);
      toast.success(`Страна «${label}» добавлена (расчёт как Китай, валюта ${newCountryCurrency})`);
      onSaved?.(nextItems, nextOrigins);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось добавить страну");
    } finally {
      setOriginBusy(false);
    }
  };

  const handleRemoveCountry = async () => {
    if (!selectedIsCustom) return;
    const label = tabLabel(selectedOrigin, customOrigins);
    if (
      !window.confirm(
        `Удалить страну «${label}» и все её поля расходов? Это нельзя отменить.`,
      )
    ) {
      return;
    }
    setOriginBusy(true);
    try {
      const saved = await api.calculatorExpenseTemplate.removeOrigin(String(selectedOrigin));
      const nextItems = cloneItems(saved.expenseItems);
      const nextOrigins = saved.customOrigins ?? [];
      setItems(nextItems);
      setCustomOrigins(nextOrigins);
      setSelectedOrigin("china");
      toast.success(`Страна «${label}» удалена`);
      onSaved?.(nextItems, nextOrigins);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить страну");
    } finally {
      setOriginBusy(false);
    }
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
          {countryTabs.map((tab) => {
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
          Свои страны считают как Китай: если на вкладке страны нет доставки или брокера, в
          калькуляторе подставляются поля из вкладки «Китай».
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Добавить поле
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={originBusy}
          onClick={() => setAddingCountry((open) => !open)}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Добавить страну
        </Button>
        {selectedIsCustom && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={originBusy}
            className="text-destructive hover:text-destructive"
            onClick={() => void handleRemoveCountry()}
          >
            {originBusy ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Удалить страну
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Сбросить
        </Button>
        <Button
          type="button"
          variant="brand"
          size="sm"
          disabled={saving || originBusy}
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

      {addingCountry && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-muted/10 p-3">
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Название страны</Label>
            <Input
              value={newCountryLabel}
              placeholder="Например, ОАЭ"
              maxLength={80}
              disabled={originBusy}
              onChange={(event) => setNewCountryLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleAddCountry();
                }
              }}
            />
          </div>
          <div className="w-full space-y-1.5 sm:w-[7rem]">
            <Label className="text-xs text-muted-foreground">Валюта ввода</Label>
            <Select
              value={newCountryCurrency}
              disabled={originBusy}
              onValueChange={(value) =>
                setNewCountryCurrency(value as CalculatorExpenseItem["currency"])
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
          <Button
            type="button"
            variant="brand"
            size="sm"
            disabled={originBusy}
            onClick={() => void handleAddCountry()}
          >
            {originBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Создать
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={originBusy}
            onClick={() => {
              setAddingCountry(false);
              setNewCountryLabel("");
              setNewCountryCurrency("CNY");
            }}
          >
            Отмена
          </Button>
        </div>
      )}

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
