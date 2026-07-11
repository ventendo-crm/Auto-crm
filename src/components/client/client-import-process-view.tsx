"use client";

import { CarCarrierTracking } from "@/components/deals/car-carrier-tracking";
import { CarCarrierDestination, CarCarrierTrackingPoint } from "@/lib/types";

interface ClientImportProcessViewProps {
  dealId: string;
  carCarrierTracking?: CarCarrierTrackingPoint[];
  carCarrierDestination?: CarCarrierDestination | null;
}

export function ClientImportProcessView({
  dealId,
  carCarrierTracking,
  carCarrierDestination,
}: ClientImportProcessViewProps) {
  return (
    <CarCarrierTracking
      dealId={dealId}
      canEdit={false}
      initialPoints={carCarrierTracking}
      initialDestination={carCarrierDestination}
    />
  );
}
