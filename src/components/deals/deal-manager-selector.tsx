"use client";

import { toast } from "sonner";
import { ManagersMultiSelect } from "@/components/deals/managers-multi-select";
import { formatDealManagersLabel } from "@/lib/deal-managers";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";
import { canAssignDealManager, getClientRoleName } from "@/lib/permissions";
import { DealManager } from "@/lib/types";

interface DealManagerSelectorProps {
  dealId: string;
  managerIds: string[];
  managers?: DealManager[];
  onChanged: () => void;
}

export function DealManagerSelector({
  dealId,
  managerIds,
  managers = [],
  onChanged,
}: DealManagerSelectorProps) {
  const { user } = useAuth();
  const role = getClientRoleName(user);
  const canAssign =
    role && user
      ? canAssignDealManager(role, user.id, {
          managerId: managerIds[0] ?? null,
          managerIds,
          managers,
        })
      : false;
  const label = formatDealManagersLabel({
    managerId: managerIds[0] ?? null,
    managerIds,
    managers,
  });

  if (!canAssign) {
    return <span className="text-sm font-medium">{label}</span>;
  }

  const handleChange = async (value: string[]) => {
    const current = [...managerIds].sort().join(",");
    const next = [...value].sort().join(",");
    if (current === next) return;

    try {
      await api.deals.update(dealId, { managerIds: value });
      toast.success(value.length > 0 ? "Менеджеры обновлены" : "Менеджеры сняты");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось назначить менеджеров");
    }
  };

  return <ManagersMultiSelect value={managerIds} onValueChange={(value) => void handleChange(value)} />;
}
