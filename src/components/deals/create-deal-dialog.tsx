"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ManagerSelect } from "@/components/deals/manager-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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
  const isAdmin = role ? canAssignDealManager(role) : false;
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
    managerId: "",
  });
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    try {
      await api.deals.create({
        ...form,
        prepayment: form.prepayment ? Number(form.prepayment) : undefined,
        carYear: undefined,
        managerId: isAdmin && form.managerId ? form.managerId : undefined,
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
        managerId: "",
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая сделка</DialogTitle>
          <DialogDescription>Заполните основные данные клиента и автомобиля</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Клиент</Label>
              <Input
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                required
              />
            </div>
            {isAdmin && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Менеджер (необязательно)</Label>
                <ManagerSelect
                  allowEmpty
                  value={form.managerId}
                  onValueChange={(managerId) => setForm({ ...form, managerId })}
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
          <Button type="submit" variant="brand" className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Создать сделку
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
