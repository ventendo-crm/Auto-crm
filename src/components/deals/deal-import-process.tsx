"use client";

import { CarCarrierTracking } from "@/components/deals/car-carrier-tracking";

interface DealImportProcessProps {
  dealId: string;
  canEdit?: boolean;
  onChanged?: () => void;
}

export function DealImportProcess({ dealId, canEdit = false }: DealImportProcessProps) {
  return <CarCarrierTracking dealId={dealId} canEdit={canEdit} />;
}
