"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { DealExpenseItem } from "@/lib/services/deal-expenses";
import { formatCurrency } from "@/lib/utils";

interface ExpenseRow {
  key: string;
  description: string;
  amount: string;
}

interface DealExpensesProps {
  dealId: string;
  canEdit: boolean;
}

function createEmptyRow(): ExpenseRow {
  return {
    key: crypto.randomUUID(),
    description: "",
    amount: "",
  };
}

function toRows(expenses: DealExpenseItem[]): ExpenseRow[] {
  if (expenses.length === 0) {
    return [createEmptyRow()];
  }

  return expenses.map((item) => ({
    key: item.id,
    description: item.description,
    amount: item.amount > 0 ? String(item.amount) : "",
  }));
}

function parseAmount(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function isEmptyRow(row: ExpenseRow): boolean {
  return !row.description.trim() && parseAmount(row.amount) <= 0;
}

function meaningfulPayload(rows: ExpenseRow[]) {
  return rows
    .filter((row) => !isEmptyRow(row))
    .map((row) => ({
      description: row.description.trim(),
      amount: parseAmount(row.amount),
    }));
}

function serializePayload(rows: ExpenseRow[]): string {
  return JSON.stringify(meaningfulPayload(rows));
}

/** Сохраняет локальные key, чтобы инпуты не размонтировались и клавиатура не закрывалась. */
function mergeRowsAfterSave(current: ExpenseRow[], saved: DealExpenseItem[]): ExpenseRow[] {
  const meaningfulCurrent = current.filter((row) => !isEmptyRow(row));
  const emptyDrafts = current.filter(isEmptyRow);

  const savedRows = saved.map((item, index) => ({
    key: meaningfulCurrent[index]?.key ?? item.id,
    description: item.description,
    amount: item.amount > 0 ? String(item.amount) : "",
  }));

  if (savedRows.length === 0 && emptyDrafts.length === 0) {
    return [createEmptyRow()];
  }

  return [...savedRows, ...emptyDrafts];
}

export function DealExpenses({ dealId, canEdit }: DealExpensesProps) {
  const [rows, setRows] = useState<ExpenseRow[]>([createEmptyRow()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const rowsRef = useRef(rows);
  const lastSavedPayloadRef = useRef("");
  const savingRef = useRef(false);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + parseAmount(row.amount), 0),
    [rows],
  );

  const load = useCallback(async () => {
    try {
      const data = await api.deals.expenses.list(dealId);
      const nextRows = toRows(data);
      setRows(nextRows);
      lastSavedPayloadRef.current = serializePayload(nextRows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить расходы");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    void load();
  }, [load]);

  const savePayload = useCallback(
    async (currentRows: ExpenseRow[]) => {
      if (!canEdit || savingRef.current) return;

      const payload = meaningfulPayload(currentRows);
      const serialized = JSON.stringify(payload);

      if (serialized === lastSavedPayloadRef.current) {
        return;
      }

      savingRef.current = true;
      setSaving(true);
      try {
        const saved = await api.deals.expenses.save(dealId, payload);
        lastSavedPayloadRef.current = serialized;
        setRows((current) => mergeRowsAfterSave(current, saved));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Не удалось сохранить расходы");
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [canEdit, dealId],
  );

  const saveIfChanged = useCallback(async () => {
    await savePayload(rowsRef.current);
  }, [savePayload]);

  const addRow = () => {
    setRows((current) => [...current, createEmptyRow()]);
  };

  const removeRow = (key: string) => {
    setRows((current) => {
      const next = current.filter((row) => row.key !== key);
      const result = next.length > 0 ? next : [createEmptyRow()];
      rowsRef.current = result;
      void savePayload(result);
      return result;
    });
  };

  const updateRow = (key: string, patch: Partial<Pick<ExpenseRow, "description" | "amount">>) => {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-card">
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Расходы</CardTitle>
        {saving && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Сохранение...
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Описание расхода"
              value={row.description}
              onChange={(e) => updateRow(row.key, { description: e.target.value })}
              onBlur={() => void saveIfChanged()}
              disabled={!canEdit}
              className="sm:flex-1"
            />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0"
                value={row.amount}
                onChange={(e) => updateRow(row.key, { amount: e.target.value })}
                onBlur={() => void saveIfChanged()}
                disabled={!canEdit}
                className="w-full sm:w-36"
              />
              {canEdit && rows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(row.key)}
                  aria-label="Удалить строку"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}

        {canEdit && (
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4" />
            Добавить строку
          </Button>
        )}

        <div className="border-t pt-3">
          <p className="text-sm text-muted-foreground">Итого</p>
          <p className="text-xl font-semibold">{formatCurrency(total)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
