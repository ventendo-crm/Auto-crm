"use client";

import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import type { CustomsCalculatorInput } from "@/lib/customs-calculator";
import type { DealListItem } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface SaveEstimateToDealButtonProps {
  input: CustomsCalculatorInput;
  totalWithCar: number;
  disabled?: boolean;
  note?: string;
  onNoteChange?: (note: string) => void;
}

export function SaveEstimateToDealButton({
  input,
  totalWithCar,
  disabled = false,
  note: controlledNote,
  onNoteChange,
}: SaveEstimateToDealButtonProps) {
  const [open, setOpen] = useState(false);
  const [deals, setDeals] = useState<DealListItem[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dealId, setDealId] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [search, setSearch] = useState("");
  const note = controlledNote ?? internalNote;
  const setNote = onNoteChange ?? setInternalNote;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingDeals(true);
    void api.deals
      .list({ search: search.trim() || undefined, limit: 50 })
      .then((page) => {
        if (!cancelled) setDeals(page.items);
      })
      .catch(() => {
        if (!cancelled) {
          setDeals([]);
          toast.error("Не удалось загрузить сделки");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDeals(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, search]);

  const handleSave = async () => {
    if (!dealId) {
      toast.error("Выберите сделку");
      return;
    }
    setSaving(true);
    try {
      await api.deals.customsEstimates.create(dealId, {
        input,
        note: note.trim() || null,
      });
      toast.success("Расчёт сохранён в сделку");
      setOpen(false);
      setNote("");
      setDealId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить расчёт");
    } finally {
      setSaving(false);
    }
  };

  const handleNoteChange = (value: string) => {
    setNote(value.slice(0, 500));
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Save className="mr-1.5 h-4 w-4" />
        Добавить в сделку
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сохранить расчёт в сделку</DialogTitle>
            <DialogDescription>
              Итого {formatCurrency(totalWithCar)}. Клиент увидит полный расчёт во вкладке «Расчёт».
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deal-search">Поиск сделки</Label>
              <Input
                id="deal-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Имя клиента, VIN, авто…"
              />
            </div>

            <div className="space-y-2">
              <Label>Сделка</Label>
              <Select value={dealId} onValueChange={setDealId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingDeals ? "Загрузка…" : "Выберите сделку"} />
                </SelectTrigger>
                <SelectContent>
                  {deals.map((deal) => (
                    <SelectItem key={deal.id} value={deal.id}>
                      {deal.clientName}
                      {deal.carBrand || deal.carModel
                        ? ` · ${[deal.carBrand, deal.carModel].filter(Boolean).join(" ")}`
                        : ""}
                      {deal.vin ? ` · ${deal.vin}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimate-note">Комментарий менеджера</Label>
              <Input
                id="estimate-note"
                value={note}
                onChange={(event) => handleNoteChange(event.target.value)}
                placeholder="Например: вариант с доставкой до Москвы"
                maxLength={500}
              />
            </div>

            <Button
              type="button"
              variant="brand"
              className="w-full"
              disabled={saving || !dealId}
              onClick={() => void handleSave()}
            >
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Сохранить расчёт
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
