"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ManagerSelect } from "@/components/deals/manager-select";
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
import { api } from "@/lib/api-client";
import { canAssignDealManager, canManageDealClient, getClientRoleName } from "@/lib/permissions";
import { DealDetail } from "@/lib/types";

interface EditDealForm {
  clientName: string;
  phone: string;
  email: string;
  vin: string;
  carBrand: string;
  carModel: string;
  destinationCity: string;
  destinationCountry: string;
  expectedArrival: string;
  actualArrival: string;
  prepayment: string;
  balance: string;
  managerId: string | null;
}

interface Props {
  deal: DealDetail;
  onUpdated?: () => void;
  canEdit?: boolean;
  canViewFinances?: boolean;
}

function toForm(deal: DealDetail): EditDealForm {
  const toDate = (value?: string | null) =>
    value ? new Date(value).toISOString().split("T")[0] : "";

  return {
    clientName: deal.clientName ?? "",
    phone: deal.phone ?? "",
    email: deal.email ?? "",
    vin: deal.vin ?? "",
    carBrand: deal.carBrand ?? "",
    carModel: deal.carModel ?? "",
    destinationCity: deal.destinationCity ?? "",
    destinationCountry: deal.destinationCountry ?? "",
    expectedArrival: toDate(deal.expectedArrival),
    actualArrival: toDate(deal.actualArrival),
    prepayment: deal.prepayment != null ? String(deal.prepayment) : "",
    balance: deal.balance != null ? String(deal.balance) : "",
    managerId: deal.managerId,
  };
}

export function EditDealDialog({
  deal,
  onUpdated,
  canEdit: canEditProp,
  canViewFinances = false,
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<EditDealForm>(() => toForm(deal));

  const canEdit = canEditProp ?? canManageDealClient(user, deal.managerId);
  const canAssignManager = (() => {
    const role = getClientRoleName(user);
    return role ? canAssignDealManager(role) : false;
  })();

  useEffect(() => {
    if (open) {
      setForm(toForm(deal));
    }
  }, [deal, open]);

  if (!canEdit) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.deals.update(deal.id, {
        clientName: form.clientName,
        phone: form.phone || null,
        email: form.email || null,
        vin: form.vin || null,
        carBrand: form.carBrand || null,
        carModel: form.carModel || null,
        destinationCity: form.destinationCity,
        destinationCountry: form.destinationCountry,
        expectedArrival: form.expectedArrival || null,
        actualArrival: form.actualArrival || null,
        prepayment: form.prepayment ? Number(form.prepayment) : null,
        ...(canViewFinances ? { balance: form.balance ? Number(form.balance) : null } : {}),
        ...(canAssignManager ? { managerId: form.managerId } : {}),
      });

      toast.success("Данные сделки обновлены");
      setOpen(false);
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4" />
          Редактировать
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1.5 px-6 pb-4 pt-6 pr-12 text-left">
          <DialogTitle>Редактирование сделки</DialogTitle>
          <DialogDescription>
            Измените данные клиента, автомобиля и логистики
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-1">
            <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-clientName">Клиент</Label>
              <Input
                id="edit-clientName"
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                required
              />
            </div>

            {canAssignManager && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit-managerId">Менеджер (необязательно)</Label>
                <ManagerSelect
                  id="edit-managerId"
                  allowEmpty
                  value={form.managerId ?? ""}
                  onValueChange={(managerId) => setForm({ ...form, managerId: managerId || null })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-phone">Телефон</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">E-mail</Label>
              <Input
                id="edit-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-vin">VIN</Label>
              <Input
                id="edit-vin"
                value={form.vin}
                onChange={(e) =>
                  setForm({ ...form, vin: e.target.value.toUpperCase() })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-carBrand">Марка</Label>
              <Input
                id="edit-carBrand"
                value={form.carBrand}
                onChange={(e) => setForm({ ...form, carBrand: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-carModel">Модель</Label>
              <Input
                id="edit-carModel"
                value={form.carModel}
                onChange={(e) => setForm({ ...form, carModel: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-destinationCity">Город</Label>
              <Input
                id="edit-destinationCity"
                value={form.destinationCity}
                onChange={(e) =>
                  setForm({ ...form, destinationCity: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-destinationCountry">Страна</Label>
              <Input
                id="edit-destinationCountry"
                value={form.destinationCountry}
                onChange={(e) =>
                  setForm({ ...form, destinationCountry: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-expectedArrival">Ожидаемое прибытие</Label>
              <Input
                id="edit-expectedArrival"
                type="date"
                value={form.expectedArrival}
                onChange={(e) =>
                  setForm({ ...form, expectedArrival: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-actualArrival">Фактическое прибытие</Label>
              <Input
                id="edit-actualArrival"
                type="date"
                value={form.actualArrival}
                onChange={(e) =>
                  setForm({ ...form, actualArrival: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-prepayment">Предоплата (₽)</Label>
              <Input
                id="edit-prepayment"
                type="number"
                min={0}
                value={form.prepayment}
                onChange={(e) => setForm({ ...form, prepayment: e.target.value })}
              />
            </div>

            {canViewFinances && (
              <div className="space-y-2">
                <Label htmlFor="edit-balance">Остаток (₽)</Label>
                <Input
                  id="edit-balance"
                  type="number"
                  min={0}
                  value={form.balance}
                  onChange={(e) => setForm({ ...form, balance: e.target.value })}
                />
              </div>
            )}
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
              Сохранить
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
