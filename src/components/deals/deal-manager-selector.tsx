"use client";

import { toast } from "sonner";
import { ManagerSelect } from "@/components/deals/manager-select";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";
import { canAssignDealManager, getClientRoleName } from "@/lib/permissions";

interface DealManagerSelectorProps {
  dealId: string;
  managerId: string | null;
  managerName?: string | null;
  onChanged: () => void;
}

export function DealManagerSelector({
  dealId,
  managerId,
  managerName,
  onChanged,
}: DealManagerSelectorProps) {
  const { user } = useAuth();
  const role = getClientRoleName(user);
  const canAssign = role ? canAssignDealManager(role) : false;
  const label = managerName ?? "Не назначен";

  if (!canAssign) {
    return <span className="text-sm font-medium">{label}</span>;
  }

  const handleChange = async (value: string) => {
    if (!value || value === managerId) return;

    try {
      await api.deals.update(dealId, { managerId: value });
      toast.success("Менеджер назначен");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось назначить менеджера");
    }
  };

  return (
    <ManagerSelect
      allowEmpty={!managerId}
      value={managerId ?? ""}
      onValueChange={handleChange}
    />
  );
}
