"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HelpView } from "@/components/help/help-view";
import { Header } from "@/components/layout/header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { canAccessHelp, getClientRoleName } from "@/lib/permissions";

export default function HelpPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const role = getClientRoleName(user);
  const allowed = role ? canAccessHelp(role) : false;

  useEffect(() => {
    if (loading) return;
    if (!allowed) {
      router.replace("/dashboard");
    }
  }, [allowed, loading, router]);

  if (loading || !allowed) {
    return (
      <>
        <Header title="Помощь" subtitle="Инструкции по работе в CRM" />
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Помощь"
        subtitle="Как создавать сделки, привязывать клиента и работать с процессами"
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <HelpView />
      </div>
    </>
  );
}
