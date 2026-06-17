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
import { STAGE_LABELS } from "@/lib/constants";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { canManageDealClient } from "@/lib/permissions";

interface DealStageSelectorProps {
  dealId: string;
  currentStage: DealStageType;
  managerId: string;
  onChanged: () => void;
}

export function DealStageSelector({
  dealId,
  currentStage,
  managerId,
  onChanged,
}: DealStageSelectorProps) {
  const { user } = useAuth();
  const canChange = canManageDealClient(user, managerId);

  if (!canChange) {
    return (
      <span className="text-sm text-muted-foreground">{STAGE_LABELS[currentStage]}</span>
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
        {Object.values(DealStageType).map((stage) => (
          <SelectItem key={stage} value={stage}>
            {STAGE_LABELS[stage]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
