"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditDealDialog } from "@/components/deals/edit-deal-dialog";
import { DealDetail } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

const fields: Array<{
  label: string;
  value: (deal: DealDetail) => string;
}> = [
  { label: "Менеджер", value: (d) => d.manager.name },
  { label: "Клиент", value: (d) => d.clientName },
  { label: "Телефон", value: (d) => d.phone ?? "—" },
  { label: "Email", value: (d) => d.email ?? "—" },
  { label: "VIN", value: (d) => d.vin || "—" },
  { label: "Марка / модель", value: (d) => [d.carBrand, d.carModel].filter(Boolean).join(" ") || "—" },
  { label: "Стоимость", value: (d) => formatCurrency(d.purchasePrice) },
  { label: "Предоплата", value: (d) => formatCurrency(d.prepayment) },
  { label: "Остаток", value: (d) => formatCurrency(d.balance) },
  { label: "Ожидаемое прибытие", value: (d) => formatDate(d.expectedArrival) },
  { label: "Фактическое прибытие", value: (d) => formatDate(d.actualArrival) },
  { label: "Страна", value: (d) => d.destinationCountry },
  { label: "Город", value: (d) => d.destinationCity },
];

interface DealInfoProps {
  deal: DealDetail;
  onUpdated?: () => void;
  canEdit?: boolean;
}

export function DealInfo({ deal, onUpdated, canEdit }: DealInfoProps) {
  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Карточка клиента</CardTitle>
        <EditDealDialog deal={deal} onUpdated={onUpdated} canEdit={canEdit} />
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label} className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">{field.label}</p>
            <p className="mt-1 text-sm font-medium">{field.value(deal)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
