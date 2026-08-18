"use client";

import { Calculator, Copy, Loader2, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CustomsEstimateSnapshot } from "@/components/calculator/customs-estimate-snapshot";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import type { MediaItem, SearchProcessEntryEstimate } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const CURRENCY_OPTIONS = [
  { value: "RUB", label: "Рубль" },
  { value: "USD", label: "Доллар США" },
  { value: "CNY", label: "Юань" },
  { value: "KRW", label: "Вона" },
] as const;

function defaultCurrencyByDealOrigin(origin: string | null | undefined): SearchProcessEntryEstimate["currency"] {
  if (origin === "korea") return "KRW";
  if (origin === "kyrgyzstan") return "USD";
  return "CNY";
}

interface SearchProcessEntryEstimateProps {
  dealId: string;
  entry: SearchProcessEstimateEntryLike;
  previousEntry?: SearchProcessEstimateEntryLike | null;
  destinationCountry?: string | null;
  canEdit?: boolean;
  onUpdated?: (estimate: SearchProcessEntryEstimate | null) => void;
}

type SearchProcessEstimateEntryLike = {
  id: string;
  estimate?: SearchProcessEntryEstimate | null;
  media?: MediaItem[];
};

export function SearchProcessEntryEstimatePanel({
  dealId,
  entry,
  previousEntry,
  destinationCountry,
  canEdit = false,
  onUpdated,
}: SearchProcessEntryEstimateProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const initial = useMemo(
    () => ({
      price: entry.estimate?.price ? String(entry.estimate.price) : "",
      currency: entry.estimate?.currency ?? defaultCurrencyByDealOrigin(destinationCountry),
      powerHp: entry.estimate?.powerHp ? String(entry.estimate.powerHp) : "",
      volumeCc: entry.estimate?.volumeCc ? String(entry.estimate.volumeCc) : "",
      carYear: entry.estimate?.carYear ? String(entry.estimate.carYear) : "",
      note: entry.estimate?.note ?? "",
    }),
    [destinationCountry, entry.estimate],
  );

  const [price, setPrice] = useState(initial.price);
  const [currency, setCurrency] = useState<SearchProcessEntryEstimate["currency"]>(initial.currency);
  const [powerHp, setPowerHp] = useState(initial.powerHp);
  const [volumeCc, setVolumeCc] = useState(initial.volumeCc);
  const [carYear, setCarYear] = useState(initial.carYear);
  const [note, setNote] = useState(initial.note);

  useEffect(() => {
    resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.price, initial.currency, initial.powerHp, initial.volumeCc, initial.carYear, initial.note]);

  const resetForm = () => {
    setPrice(initial.price);
    setCurrency(initial.currency);
    setPowerHp(initial.powerHp);
    setVolumeCc(initial.volumeCc);
    setCarYear(initial.carYear);
    setNote(initial.note);
  };

  const applyPrevious = () => {
    if (!previousEntry?.estimate) {
      toast.error("У предыдущего варианта нет сохранённого расчёта");
      return;
    }
    setPrice(String(previousEntry.estimate.price));
    setCurrency(previousEntry.estimate.currency);
    setPowerHp(String(previousEntry.estimate.powerHp));
    setVolumeCc(String(previousEntry.estimate.volumeCc));
    setCarYear(String(previousEntry.estimate.carYear));
    setNote(previousEntry.estimate.note ?? "");
  };

  const handleSave = async () => {
    const payload = {
      price: Number(price.replace(",", ".")),
      currency,
      powerHp: Number(powerHp),
      volumeCc: Number(volumeCc),
      carYear: Number(carYear),
      note: note.trim() || null,
    };
    setSaving(true);
    try {
      const estimate = await api.searchProcess.saveEstimate(dealId, entry.id, payload);
      onUpdated?.(estimate);
      setOpen(false);
      toast.success(entry.estimate ? "Расчёт обновлён" : "Расчёт сохранён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить расчёт");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!entry.estimate || !confirm("Удалить расчёт этого варианта?")) return;
    setDeleting(true);
    try {
      await api.searchProcess.deleteEstimate(dealId, entry.id);
      onUpdated?.(null);
      toast.success("Расчёт удалён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить расчёт");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border bg-background/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Расчёт растаможки для варианта</p>
          <p className="text-xs text-muted-foreground">
            {entry.estimate
              ? `Итого: ${formatCurrency(entry.estimate.totalWithCar)}`
              : "Отдельный расчёт для этого варианта автомобиля."}
          </p>
        </div>

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
              {entry.estimate ? <Pencil className="h-4 w-4" /> : <Calculator className="h-4 w-4" />}
              {entry.estimate ? "Изменить расчёт" : "Добавить расчёт"}
            </Button>
            {entry.estimate && (
              <Button type="button" size="sm" variant="ghost" disabled={deleting} onClick={() => void handleDelete()}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Удалить
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {entry.estimate ? (
        <div className="mt-3">
          <CustomsEstimateSnapshot
            input={entry.estimate.input}
            result={entry.estimate.result}
            createdAt={entry.estimate.updatedAt}
            createdByName={entry.estimate.createdByName}
            note={entry.estimate.note}
          />
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Расчёт ещё не добавлен.</p>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!saving) {
            setOpen(next);
            if (!next) resetForm();
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{entry.estimate ? "Изменить расчёт варианта" : "Расчёт варианта"}</DialogTitle>
            <DialogDescription>
              Менеджер задаёт цену, объём, лошадиные силы и год. Детальный расчёт увидит и клиент.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`variant-price-${entry.id}`}>Стоимость авто</Label>
                <Input
                  id={`variant-price-${entry.id}`}
                  inputMode="decimal"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="Например, 25000"
                />
              </div>
              <div className="space-y-2">
                <Label>Валюта</Label>
                <Select value={currency} onValueChange={(value) => setCurrency(value as SearchProcessEntryEstimate["currency"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`variant-volume-${entry.id}`}>Объём двигателя, см3</Label>
                <Input
                  id={`variant-volume-${entry.id}`}
                  inputMode="numeric"
                  value={volumeCc}
                  onChange={(event) => setVolumeCc(event.target.value)}
                  placeholder="Например, 2000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`variant-power-${entry.id}`}>Лошадиные силы</Label>
                <Input
                  id={`variant-power-${entry.id}`}
                  inputMode="numeric"
                  value={powerHp}
                  onChange={(event) => setPowerHp(event.target.value)}
                  placeholder="Например, 150"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`variant-year-${entry.id}`}>Год выпуска</Label>
                <Input
                  id={`variant-year-${entry.id}`}
                  inputMode="numeric"
                  value={carYear}
                  onChange={(event) => setCarYear(event.target.value)}
                  placeholder="Например, 2021"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`variant-note-${entry.id}`}>Комментарий</Label>
              <Textarea
                id={`variant-note-${entry.id}`}
                value={note}
                onChange={(event) => setNote(event.target.value.slice(0, 500))}
                placeholder="Например: комплектация Premium"
                rows={2}
              />
            </div>

            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={applyPrevious} disabled={!previousEntry?.estimate}>
                  <Copy className="h-4 w-4" />
                  Данные из предыдущего варианта
                </Button>
              </div>
            )}

            <Button type="button" variant="brand" className="w-full" disabled={saving} onClick={() => void handleSave()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              Сохранить расчёт
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
