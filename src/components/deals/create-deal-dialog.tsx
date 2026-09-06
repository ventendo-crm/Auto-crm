"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ManagersMultiSelect } from "@/components/deals/managers-multi-select";
import { ExportOriginSelect } from "@/components/deals/export-origin-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useCompanyWorkspace } from "@/hooks/use-company-workspace";
import { api } from "@/lib/api-client";
import { enabledCustomDealFields } from "@/lib/company-workspace/helpers";
import { canAssignDealManager, getClientRoleName } from "@/lib/permissions";
interface CreateDealDialogProps {
  children: React.ReactNode;
  onCreated?: () => void;
}

export function CreateDealDialog({ children, onCreated }: CreateDealDialogProps) {
  const { user } = useAuth();
  const { settings } = useCompanyWorkspace();
  const role = getClientRoleName(user);
  const canAssignManagers = role && user ? canAssignDealManager(role, user.id) : false;
  const customFields = enabledCustomDealFields(settings.customDealFields);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    clientName: "",
    vin: "",
    carBrand: "",
    carModel: "",
    carYear: "",
    destinationCity: "",
    destinationCountry: "china",
    prepayment: "",
    balance: "",
    managerIds: [] as string[],
    extra: {} as Record<string, string>,
  });

  const resetForm = () =>
    setForm({
      clientName: "",
      vin: "",
      carBrand: "",
      carModel: "",
      carYear: "",
      destinationCity: "",
      destinationCountry: "china",
      prepayment: "",
      balance: "",
      managerIds: [],
      extra: {},
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    try {
      await api.deals.create({
        clientName: form.clientName,
        vin: settings.dealFields.vin.enabled ? form.vin || undefined : undefined,
        carBrand: form.carBrand || undefined,
        carModel: form.carModel || undefined,
        carYear:
          settings.dealFields.carYear.enabled && form.carYear
            ? Number(form.carYear)
            : undefined,
        destinationCity: settings.dealFields.destinationCity.enabled ? form.destinationCity : "",
        destinationCountry: form.destinationCountry,
        prepayment: form.prepayment ? Number(form.prepayment) : undefined,
        balance: form.balance ? Number(form.balance) : undefined,
        managerIds: canAssignManagers && form.managerIds.length > 0 ? form.managerIds : undefined,
        customFields: Object.fromEntries(customFields.map((field) => [field.id, form.extra[field.id] ?? ""])),
      });
      toast.success("Сделка создана");
      setOpen(false);
      resetForm();
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка создания");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1.5 px-6 pb-4 pt-6 pr-12 text-left">
          <DialogTitle>Новая сделка</DialogTitle>
          <DialogDescription>Заполните основные данные клиента и автомобиля</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Клиент</Label>
              <Input
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                required
              />
            </div>
            {canAssignManagers && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Менеджеры</Label>
                <ManagersMultiSelect
                  value={form.managerIds}
                  onValueChange={(managerIds) => setForm({ ...form, managerIds })}
                />
              </div>
            )}
            {settings.dealFields.vin.enabled && (
            <div className="space-y-2 sm:col-span-2">
              <Label>
                VIN{settings.dealFields.vin.required ? "" : " (необязательно)"}
              </Label>
              <Input
                placeholder="Введите VIN при наличии"
                value={form.vin}
                required={settings.dealFields.vin.required}
                onChange={(e) =>
                  setForm({
                    ...form,
                    vin: e.target.value.toUpperCase(),
                  })
                }
              />
            </div>
            )}
            <div className="space-y-2">
              <Label>Марка</Label>
              <Input
                value={form.carBrand}
                onChange={(e) => setForm({ ...form, carBrand: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Модель</Label>
              <Input
                value={form.carModel}
                onChange={(e) => setForm({ ...form, carModel: e.target.value })}
              />
            </div>
            {settings.dealFields.carYear.enabled && (
            <div className="space-y-2">
              <Label>Год{settings.dealFields.carYear.required ? "" : " (необязательно)"}</Label>
              <Input
                type="number"
                min={1900}
                max={2100}
                value={form.carYear}
                required={settings.dealFields.carYear.required}
                onChange={(e) => setForm({ ...form, carYear: e.target.value })}
              />
            </div>
            )}
            {settings.dealFields.destinationCity.enabled && (
            <div className="space-y-2">
              <Label>Город</Label>
              <Input
                value={form.destinationCity}
                onChange={(e) => setForm({ ...form, destinationCity: e.target.value })}
                required={settings.dealFields.destinationCity.required}
              />
            </div>
            )}
            <div className="space-y-2">
              <Label>Страна экспорта</Label>
              <ExportOriginSelect
                value={form.destinationCountry}
                onValueChange={(destinationCountry) =>
                  setForm({ ...form, destinationCountry })
                }
              />
            </div>
            {customFields.map((field) => (
              <div key={field.id} className="space-y-2 sm:col-span-2">
                <Label>
                  {field.label}
                  {field.required ? "" : " (необязательно)"}
                </Label>
                <Input
                  value={form.extra[field.id] ?? ""}
                  required={field.required}
                  onChange={(e) =>
                    setForm({ ...form, extra: { ...form.extra, [field.id]: e.target.value } })
                  }
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label>Предоплата (₽)</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={form.prepayment}
                onChange={(e) => setForm({ ...form, prepayment: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Остаток (₽)</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={form.balance}
                onChange={(e) => setForm({ ...form, balance: e.target.value })}
              />
            </div>
          </div>
          </div>
          <div className="flex shrink-0 gap-2 border-t bg-background px-6 py-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="flex-1" disabled={loading}>
                Отмена
              </Button>
            </DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Создать
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
