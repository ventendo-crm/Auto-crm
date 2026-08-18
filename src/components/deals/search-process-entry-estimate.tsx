"use client";

import { Calculator, Copy, Loader2, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CustomsEstimateSnapshot } from "@/components/calculator/customs-estimate-snapshot";
import { isChinaLikeOrigin } from "@/lib/customs-calculator";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible-panel";
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

type DeliveryRoute = "ussuriysk" | "kazakhstan" | "vladivostok";

function parseAmount(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const originCountry = entry.estimate?.input.originCountry ?? destinationCountry ?? "china";
  const isChina = isChinaLikeOrigin(originCountry);
  const isKorea = originCountry === "korea";
  const isKyrgyzstan = originCountry === "kyrgyzstan";

  const initial = useMemo(
    () => ({
      price: entry.estimate?.price ? String(entry.estimate.price) : "",
      currency: entry.estimate?.currency ?? defaultCurrencyByDealOrigin(destinationCountry),
      powerHp: entry.estimate?.powerHp ? String(entry.estimate.powerHp) : "",
      volumeCc: entry.estimate?.volumeCc ? String(entry.estimate.volumeCc) : "",
      carYear: entry.estimate?.carYear ? String(entry.estimate.carYear) : "",
      chinaExpensesCny: String(entry.estimate?.input.chinaExpensesCny ?? (isChina ? 12000 : 0)),
      cityDeliveryUsd: String(entry.estimate?.input.cityDeliveryUsd ?? 0),
      koreaDocsDeliveryKrw: String(entry.estimate?.input.koreaDocsDeliveryKrw ?? 0),
      parkingFeeKrw: String(entry.estimate?.input.parkingFeeKrw ?? 0),
      brokerFeeRub: String(entry.estimate?.input.brokerFeeRub ?? 0),
      deliveryRoute: (entry.estimate?.input.deliveryRoute ?? (isKorea ? "vladivostok" : "ussuriysk")) as DeliveryRoute,
      deliveryRub: String(entry.estimate?.input.deliveryRub ?? 0),
      deliveryUsd: String(entry.estimate?.input.deliveryUsd ?? 0),
      escortRub: String(entry.estimate?.input.escortRub ?? 0),
      note: entry.estimate?.note ?? "",
    }),
    [destinationCountry, entry.estimate, isChina, isKorea],
  );

  const [price, setPrice] = useState(initial.price);
  const [currency, setCurrency] = useState<SearchProcessEntryEstimate["currency"]>(initial.currency);
  const [powerHp, setPowerHp] = useState(initial.powerHp);
  const [volumeCc, setVolumeCc] = useState(initial.volumeCc);
  const [carYear, setCarYear] = useState(initial.carYear);
  const [chinaExpensesCny, setChinaExpensesCny] = useState(initial.chinaExpensesCny);
  const [cityDeliveryUsd, setCityDeliveryUsd] = useState(initial.cityDeliveryUsd);
  const [koreaDocsDeliveryKrw, setKoreaDocsDeliveryKrw] = useState(initial.koreaDocsDeliveryKrw);
  const [parkingFeeKrw, setParkingFeeKrw] = useState(initial.parkingFeeKrw);
  const [brokerFeeRub, setBrokerFeeRub] = useState(initial.brokerFeeRub);
  const [deliveryRoute, setDeliveryRoute] = useState<DeliveryRoute>(initial.deliveryRoute);
  const [deliveryRub, setDeliveryRub] = useState(initial.deliveryRub);
  const [deliveryUsd, setDeliveryUsd] = useState(initial.deliveryUsd);
  const [escortRub, setEscortRub] = useState(initial.escortRub);
  const [note, setNote] = useState(initial.note);

  useEffect(() => {
    resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initial.price,
    initial.currency,
    initial.powerHp,
    initial.volumeCc,
    initial.carYear,
    initial.chinaExpensesCny,
    initial.cityDeliveryUsd,
    initial.koreaDocsDeliveryKrw,
    initial.parkingFeeKrw,
    initial.brokerFeeRub,
    initial.deliveryRoute,
    initial.deliveryRub,
    initial.deliveryUsd,
    initial.escortRub,
    initial.note,
  ]);

  const resetForm = () => {
    setPrice(initial.price);
    setCurrency(initial.currency);
    setPowerHp(initial.powerHp);
    setVolumeCc(initial.volumeCc);
    setCarYear(initial.carYear);
    setChinaExpensesCny(initial.chinaExpensesCny);
    setCityDeliveryUsd(initial.cityDeliveryUsd);
    setKoreaDocsDeliveryKrw(initial.koreaDocsDeliveryKrw);
    setParkingFeeKrw(initial.parkingFeeKrw);
    setBrokerFeeRub(initial.brokerFeeRub);
    setDeliveryRoute(initial.deliveryRoute);
    setDeliveryRub(initial.deliveryRub);
    setDeliveryUsd(initial.deliveryUsd);
    setEscortRub(initial.escortRub);
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
    setChinaExpensesCny(String(previousEntry.estimate.input.chinaExpensesCny ?? 0));
    setCityDeliveryUsd(String(previousEntry.estimate.input.cityDeliveryUsd ?? 0));
    setKoreaDocsDeliveryKrw(String(previousEntry.estimate.input.koreaDocsDeliveryKrw ?? 0));
    setParkingFeeKrw(String(previousEntry.estimate.input.parkingFeeKrw ?? 0));
    setBrokerFeeRub(String(previousEntry.estimate.input.brokerFeeRub ?? 0));
    setDeliveryRoute((previousEntry.estimate.input.deliveryRoute ?? "ussuriysk") as DeliveryRoute);
    setDeliveryRub(String(previousEntry.estimate.input.deliveryRub ?? 0));
    setDeliveryUsd(String(previousEntry.estimate.input.deliveryUsd ?? 0));
    setEscortRub(String(previousEntry.estimate.input.escortRub ?? 0));
    setNote(previousEntry.estimate.note ?? "");
  };

  const handleSave = async () => {
    const payload = {
      price: parseAmount(price),
      currency,
      powerHp: Number(powerHp),
      volumeCc: Number(volumeCc),
      carYear: Number(carYear),
      chinaExpensesCny: parseAmount(chinaExpensesCny),
      cityDeliveryUsd: parseAmount(cityDeliveryUsd),
      koreaDocsDeliveryKrw: parseAmount(koreaDocsDeliveryKrw),
      parkingFeeKrw: parseAmount(parkingFeeKrw),
      brokerFeeRub: parseAmount(brokerFeeRub),
      deliveryRoute,
      deliveryRub: parseAmount(deliveryRub),
      deliveryUsd: parseAmount(deliveryUsd),
      escortRub: parseAmount(escortRub),
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
          {entry.estimate ? (
            <p className="mt-1 text-lg font-semibold tabular-nums">
              Итого: {formatCurrency(entry.estimate.totalWithCar)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Отдельный расчёт для этого варианта автомобиля.
            </p>
          )}
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
        <div className="mt-3 rounded-lg border bg-muted/10">
          <CollapsibleTrigger
            open={detailsOpen}
            onToggle={() => setDetailsOpen((value) => !value)}
            className="px-3 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Подробный расчёт</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {detailsOpen ? "Скрыть детализацию" : "Показать детализацию"}
              </p>
            </div>
          </CollapsibleTrigger>

          <CollapsiblePanel open={detailsOpen} className="border-t px-3 pb-3 pt-3">
            <CustomsEstimateSnapshot
              input={entry.estimate.input}
              result={entry.estimate.result}
              createdAt={entry.estimate.updatedAt}
              createdByName={entry.estimate.createdByName}
              note={entry.estimate.note}
            />
          </CollapsiblePanel>
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
              Менеджер задаёт цену, объём, лошадиные силы, год и при необходимости меняет услуги вручную.
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

            <div className="rounded-xl border bg-muted/10 p-4">
              <p className="text-sm font-medium">Услуги и расходы</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {isChina && (
                  <div className="space-y-2">
                    <Label htmlFor={`variant-china-expenses-${entry.id}`}>Расходы по Китаю, CNY</Label>
                    <Input
                      id={`variant-china-expenses-${entry.id}`}
                      inputMode="decimal"
                      value={chinaExpensesCny}
                      onChange={(event) => setChinaExpensesCny(event.target.value)}
                    />
                  </div>
                )}

                {isKyrgyzstan && (
                  <div className="space-y-2">
                    <Label htmlFor={`variant-city-delivery-${entry.id}`}>Доставка до города, USD</Label>
                    <Input
                      id={`variant-city-delivery-${entry.id}`}
                      inputMode="decimal"
                      value={cityDeliveryUsd}
                      onChange={(event) => setCityDeliveryUsd(event.target.value)}
                    />
                  </div>
                )}

                {isKorea && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor={`variant-korea-parking-${entry.id}`}>Комиссия стоянки, KRW</Label>
                      <Input
                        id={`variant-korea-parking-${entry.id}`}
                        inputMode="decimal"
                        value={parkingFeeKrw}
                        onChange={(event) => setParkingFeeKrw(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`variant-korea-docs-${entry.id}`}>Документы и доставка до РФ, KRW</Label>
                      <Input
                        id={`variant-korea-docs-${entry.id}`}
                        inputMode="decimal"
                        value={koreaDocsDeliveryKrw}
                        onChange={(event) => setKoreaDocsDeliveryKrw(event.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor={`variant-broker-${entry.id}`}>Услуги брокера, RUB</Label>
                  <Input
                    id={`variant-broker-${entry.id}`}
                    inputMode="decimal"
                    value={brokerFeeRub}
                    onChange={(event) => setBrokerFeeRub(event.target.value)}
                  />
                </div>

                {!isKyrgyzstan && (
                  <>
                    <div className="space-y-2">
                      <Label>Маршрут доставки</Label>
                      <Select value={deliveryRoute} onValueChange={(value) => setDeliveryRoute(value as DeliveryRoute)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ussuriysk">Через Уссурийск</SelectItem>
                          <SelectItem value="kazakhstan">Через Казахстан</SelectItem>
                          {isKorea ? <SelectItem value="vladivostok">Из Владивостока</SelectItem> : null}
                        </SelectContent>
                      </Select>
                    </div>

                    {deliveryRoute === "kazakhstan" ? (
                      <div className="space-y-2">
                        <Label htmlFor={`variant-delivery-usd-${entry.id}`}>Доставка через Казахстан, USD</Label>
                        <Input
                          id={`variant-delivery-usd-${entry.id}`}
                          inputMode="decimal"
                          value={deliveryUsd}
                          onChange={(event) => setDeliveryUsd(event.target.value)}
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor={`variant-delivery-rub-${entry.id}`}>Доставка, RUB</Label>
                        <Input
                          id={`variant-delivery-rub-${entry.id}`}
                          inputMode="decimal"
                          value={deliveryRub}
                          onChange={(event) => setDeliveryRub(event.target.value)}
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor={`variant-escort-${entry.id}`}>Услуги сопровождения, RUB</Label>
                  <Input
                    id={`variant-escort-${entry.id}`}
                    inputMode="decimal"
                    value={escortRub}
                    onChange={(event) => setEscortRub(event.target.value)}
                  />
                </div>
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
