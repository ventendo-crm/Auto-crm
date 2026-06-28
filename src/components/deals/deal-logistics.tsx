"use client";

import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { Shipment } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const FIELDS = [
  { key: "purchaseDate", label: "Покупка" },
  { key: "shippingDate", label: "Отправка" },
  { key: "expectedArrival", label: "Ожидаемое прибытие" },
  { key: "actualArrival", label: "Фактическое прибытие" },
  { key: "customsCompleted", label: "Таможня" },
] as const;

type ShipmentForm = Record<(typeof FIELDS)[number]["key"], string>;

function toForm(shipment: Shipment | null | undefined): ShipmentForm {
  const toInput = (value?: string | null) =>
    value ? new Date(value).toISOString().slice(0, 10) : "";

  return {
    purchaseDate: toInput(shipment?.purchaseDate),
    shippingDate: toInput(shipment?.shippingDate),
    expectedArrival: toInput(shipment?.expectedArrival),
    actualArrival: toInput(shipment?.actualArrival),
    customsCompleted: toInput(shipment?.customsCompleted),
  };
}

interface DealLogisticsProps {
  dealId: string;
  shipment?: Shipment | null;
  canEdit?: boolean;
  onUpdated?: () => void;
}

export function DealLogistics({
  dealId,
  shipment,
  canEdit = false,
  onUpdated,
}: DealLogisticsProps) {
  const [form, setForm] = useState<ShipmentForm>(() => toForm(shipment));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(toForm(shipment));
  }, [shipment]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.deals.shipment.save(dealId, {
        purchaseDate: form.purchaseDate || null,
        shippingDate: form.shippingDate || null,
        expectedArrival: form.expectedArrival || null,
        actualArrival: form.actualArrival || null,
        customsCompleted: form.customsCompleted || null,
      });
      toast.success("Логистика сохранена");
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Логистика</CardTitle>
        {canEdit && (
          <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Сохранить
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(({ key, label }) => (
          <div key={key} className="rounded-lg border p-3">
            {canEdit ? (
              <div className="space-y-2">
                <Label htmlFor={`shipment-${key}`} className="text-xs text-muted-foreground">
                  {label}
                </Label>
                <Input
                  id={`shipment-${key}`}
                  type="date"
                  value={form[key]}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, [key]: event.target.value }))
                  }
                />
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm font-medium">
                  {form[key] ? formatDate(form[key]) : "—"}
                </p>
              </>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
