"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CatalogPageContent } from "@/components/catalog/catalog-page-content";
import { Header } from "@/components/layout/header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { canAccessCatalog, getClientRoleName } from "@/lib/permissions";

export default function CatalogPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const role = getClientRoleName(user);
  const allowed = role ? canAccessCatalog(role) : false;

  useEffect(() => {
    if (loading) return;
    if (!allowed) {
      router.replace("/dashboard");
    }
  }, [allowed, loading, router]);

  if (loading || !allowed) {
    return (
      <>
        <Header title="Каталог" subtitle="Загрузка..." />
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </>
    );
  }

  return <CatalogPageContent />;
}
