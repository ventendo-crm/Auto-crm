"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { DealExpenseItem, sumDealExpenses } from "@/lib/services/deal-expenses";
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

export function DealExpenses({ dealId, canEdit }: DealExpensesProps) {
  const [rows, setRows] = useState<ExpenseRow[]>([createEmptyRow()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const skipSaveRef = useRef(true);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + parseAmount(row.amount), 0),
    [rows],
  );

  const load = useCallback(async () => {
    try {
      const data = await api.deals.expenses.list(dealId);
      skipSaveRef.current = true;
      setRows(toRows(data));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить расходы");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canEdit || loading) return;

    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }

    const timer = window.setTimeout(async () => {
      setSaving(true);
      try {
        const payload = rows.map((row) => ({
          description: row.description,
          amount: parseAmount(row.amount),
        }));
        const saved = await api.deals.expenses.save(dealId, payload);
        skipSaveRef.current = true;
        setRows(toRows(saved));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Не удалось сохранить расходы");
      } finally {
        setSaving(false);
      }
    }, 800);

    return () => window.clearTimeout(timer);
  }, [canEdit, dealId, loading, rows]);

  const addRow = () => {
    setRows((current) => [...current, createEmptyRow()]);
  };

  const removeRow = (key: string) => {
    setRows((current) => {
      const next = current.filter((row) => row.key !== key);
      return next.length > 0 ? next : [createEmptyRow()];
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
