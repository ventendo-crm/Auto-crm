"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ManagersMultiSelect } from "@/components/deals/managers-multi-select";
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
import { canAssignDealManager, getClientRoleName } from "@/lib/permissions";
interface CreateDealDialogProps {
  children: React.ReactNode;
  onCreated?: () => void;
}

export function CreateDealDialog({ children, onCreated }: CreateDealDialogProps) {
  const { user } = useAuth();
  const role = getClientRoleName(user);
  const canAssignManagers = role && user ? canAssignDealManager(role, user.id) : false;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    clientName: "",
    vin: "",
    carBrand: "",
    carModel: "",
    destinationCity: "",
    destinationCountry: "Россия",
    prepayment: "",
    managerIds: [] as string[],
  });
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    try {
      await api.deals.create({
        ...form,
        prepayment: form.prepayment ? Number(form.prepayment) : undefined,
        carYear: undefined,
        managerIds: canAssignManagers && form.managerIds.length > 0 ? form.managerIds : undefined,
      });
      toast.success("Сделка создана");
      setOpen(false);
      setForm({
        clientName: "",
        vin: "",
        carBrand: "",
        carModel: "",
        destinationCity: "",
        destinationCountry: "Россия",
        prepayment: "",
        managerIds: [],
      });
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
            <div className="space-y-2 sm:col-span-2">
              <Label>VIN (необязательно)</Label>
              <Input
                placeholder="Введите VIN при наличии"
                value={form.vin}
                onChange={(e) =>
                  setForm({
                    ...form,
                    vin: e.target.value.toUpperCase(),
                  })
                }
              />
            </div>
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
            <div className="space-y-2">
              <Label>Город</Label>
              <Input
                value={form.destinationCity}
                onChange={(e) => setForm({ ...form, destinationCity: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Страна</Label>
              <Input
                value={form.destinationCountry}
                onChange={(e) => setForm({ ...form, destinationCountry: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Предоплата (₽)</Label>
              <Input
                type="number"
                value={form.prepayment}
                onChange={(e) => setForm({ ...form, prepayment: e.target.value })}
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
