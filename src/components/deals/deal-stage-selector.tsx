"use client";

import { DealStageType } from "@prisma/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STAGE_ORDER } from "@/lib/constants";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useCompanyWorkspace } from "@/hooks/use-company-workspace";
import { canManageDealClient } from "@/lib/permissions";

interface DealStageSelectorProps {
  dealId: string;
  currentStage: DealStageType;
  managerIds: string[];
  onChanged: () => void;
}

export function DealStageSelector({
  dealId,
  currentStage,
  managerIds,
  onChanged,
}: DealStageSelectorProps) {
  const { user } = useAuth();
  const { stageLabel } = useCompanyWorkspace();
  const canChange = canManageDealClient(user, managerIds);

  if (!canChange) {
    return (
      <span className="text-sm text-muted-foreground">{stageLabel(currentStage)}</span>
    );
  }

  const handleChange = async (value: string) => {
    if (value === currentStage) return;

    try {
      await api.deals.changeStage(dealId, value as DealStageType);
      toast.success("Этап обновлён");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    }
  };

  return (
    <Select value={currentStage} onValueChange={handleChange}>
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STAGE_ORDER.map((stage) => (
          <SelectItem key={stage} value={stage}>
            {stageLabel(stage)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
