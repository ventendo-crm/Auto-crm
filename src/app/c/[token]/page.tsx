"use client";

import { useParams } from "next/navigation";
import { PublicCatalogVehicleView } from "@/components/catalog/public-catalog-vehicle-view";

export default function PublicCatalogVehiclePage() {
  const params = useParams<{ token: string }>();
  if (!params.token) return null;
  return <PublicCatalogVehicleView token={params.token} />;
}
