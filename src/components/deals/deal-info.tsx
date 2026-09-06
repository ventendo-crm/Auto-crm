"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DealExportCountryLabel } from "@/components/deals/deal-export-country-label";
import { EditDealDialog } from "@/components/deals/edit-deal-dialog";
import { Input } from "@/components/ui/input";
import { formatDealManagersLabel } from "@/lib/deal-managers";
import { api } from "@/lib/api-client";
import { enabledCustomDealFields, parseCustomFieldValues } from "@/lib/company-workspace/helpers";
import { DealDetail } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useCompanyWorkspace } from "@/hooks/use-company-workspace";

type EditableDealField = "balance" | "expectedArrival" | "actualArrival" | "purchasePrice";

type DealInfoField =
  | {
      kind: "static";
      label: string;
      requiresFinances?: boolean;
      workspaceField?: "vin" | "carYear" | "destinationCity";
      value: (deal: DealDetail) => ReactNode;
    }
  | {
      kind: "editable";
      label: string;
      field: EditableDealField;
      type: "date" | "currency";
      requiresFinances?: boolean;
      inputValue: (deal: DealDetail) => string;
      displayValue: (deal: DealDetail) => string;
    };

const dealInfoFields: DealInfoField[] = [
  { kind: "static", label: "Менеджеры", value: (d) => formatDealManagersLabel(d) },
  { kind: "static", label: "Клиент", value: (d) => d.clientName },
  { kind: "static", label: "Телефон", value: (d) => d.phone ?? "—" },
  { kind: "static", label: "Email", value: (d) => d.email ?? "—" },
  { kind: "static", label: "VIN", workspaceField: "vin", value: (d) => d.vin || "—" },
  {
    kind: "static",
    label: "Марка / модель",
    value: (d) => [d.carBrand, d.carModel].filter(Boolean).join(" ") || "—",
  },
  {
    kind: "static",
    label: "Год",
    workspaceField: "carYear",
    value: (d) => (d.carYear != null ? String(d.carYear) : "—"),
  },
  {
    kind: "editable",
    label: "Бюджет",
    field: "purchasePrice",
    type: "currency",
    requiresFinances: true,
    inputValue: (d) => (d.purchasePrice != null ? String(d.purchasePrice) : ""),
    displayValue: (d) => formatCurrency(d.purchasePrice),
  },
  {
    kind: "static",
    label: "Предоплата",
    requiresFinances: true,
    value: (d) => formatCurrency(d.prepayment),
  },
  {
    kind: "editable",
    label: "Остаток",
    field: "balance",
    type: "currency",
    requiresFinances: true,
    inputValue: (d) => (d.balance != null ? String(d.balance) : ""),
    displayValue: (d) => formatCurrency(d.balance),
  },
  {
    kind: "editable",
    label: "Ожидаемое прибытие",
    field: "expectedArrival",
    type: "date",
    inputValue: (d) =>
      d.expectedArrival ? new Date(d.expectedArrival).toISOString().split("T")[0] : "",
    displayValue: (d) => formatDate(d.expectedArrival),
  },
  {
    kind: "editable",
    label: "Фактическое прибытие",
    field: "actualArrival",
    type: "date",
    inputValue: (d) =>
      d.actualArrival ? new Date(d.actualArrival).toISOString().split("T")[0] : "",
    displayValue: (d) => formatDate(d.actualArrival),
  },
  {
    kind: "static",
    label: "Страна экспорта",
    value: (d) => <DealExportCountryLabel value={d.destinationCountry} />,
  },
  { kind: "static", label: "Город", workspaceField: "destinationCity", value: (d) => d.destinationCity || "—" },
];

function EditableDealFieldCard({
  label,
  dealId,
  field,
  type,
  inputValue,
  displayValue,
  canEdit,
  onUpdated,
}: {
  label: string;
  dealId: string;
  field: EditableDealField;
  type: "date" | "currency";
  inputValue: string;
  displayValue: string;
  canEdit: boolean;
  onUpdated?: () => void;
}) {
  const [localValue, setLocalValue] = useState(inputValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalValue(inputValue);
  }, [inputValue]);

  const save = async () => {
    if (localValue === inputValue) return;

    setSaving(true);
    try {
      const payload =
        type === "currency"
          ? { [field]: localValue ? Number(localValue) : null }
          : { [field]: localValue || null };

      await api.deals.update(dealId, payload);
      toast.success("Сохранено");
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения");
      setLocalValue(inputValue);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      {canEdit ? (
        <div className="relative mt-1">
          <Input
            type={type === "date" ? "date" : "number"}
            min={type === "currency" ? 0 : undefined}
            value={localValue}
            onChange={(event) => setLocalValue(event.target.value)}
            onBlur={() => void save()}
            disabled={saving}
            className="h-8 text-sm"
          />
          {saving && (
            <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      ) : (
        <p className="mt-1 text-sm font-medium">{displayValue}</p>
      )}
    </div>
  );
}

interface DealInfoProps {
  deal: DealDetail;
  onUpdated?: () => void;
  canEdit?: boolean;
  canViewFinances?: boolean;
}

export function DealInfo({ deal, onUpdated, canEdit, canViewFinances = false }: DealInfoProps) {
  const { settings } = useCompanyWorkspace();
  const customValues = parseCustomFieldValues(deal.customFields);
  const visibleFields = dealInfoFields.filter((field) => {
    if (field.requiresFinances && !canViewFinances) return false;
    if (field.kind === "static" && field.workspaceField && !settings.dealFields[field.workspaceField].enabled) {
      return false;
    }
    return true;
  });

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Карточка клиента</CardTitle>
        <EditDealDialog
          deal={deal}
          onUpdated={onUpdated}
          canEdit={canEdit}
          canViewFinances={canViewFinances}
        />
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {visibleFields.map((field) =>
          field.kind === "editable" ? (
            <EditableDealFieldCard
              key={field.label}
              label={field.label}
              dealId={deal.id}
              field={field.field}
              type={field.type}
              inputValue={field.inputValue(deal)}
              displayValue={field.displayValue(deal)}
              canEdit={!!canEdit}
              onUpdated={onUpdated}
            />
          ) : (
            <div key={field.label} className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">{field.label}</p>
              <p className="mt-1 text-sm font-medium">{field.value(deal)}</p>
            </div>
          ),
        )}
        {enabledCustomDealFields(settings.customDealFields).map((field) => (
          <div key={field.id} className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">{field.label}</p>
            <p className="mt-1 text-sm font-medium">{customValues[field.id] || "—"}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
