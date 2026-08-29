"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { CatalogVehicleDetailView } from "@/components/catalog/catalog-vehicle-detail";
import { useAuth } from "@/hooks/use-auth";
import { canAccessCatalog, getClientRoleName } from "@/lib/permissions";

export default function CatalogVehiclePage() {
  const params = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const role = getClientRoleName(user);
  const allowed = role ? canAccessCatalog(role) : false;

  useEffect(() => {
    if (loading) return;
    if (!allowed) router.replace("/dashboard");
  }, [allowed, loading, router]);

  if (loading || !allowed || !params.id) return null;

  return <CatalogVehicleDetailView vehicleId={params.id} />;
}
