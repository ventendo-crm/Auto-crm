"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CustomsCalculator } from "@/components/calculator/customs-calculator";
import { Header } from "@/components/layout/header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { canAccessCalculator, getClientRoleName } from "@/lib/permissions";

export default function CalculatorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const role = getClientRoleName(user);
  const allowed = role ? canAccessCalculator(role) : false;

  useEffect(() => {
    if (loading) return;
    if (!allowed) {
      router.replace("/dashboard");
    }
  }, [allowed, loading, router]);

  if (loading || !allowed) {
    return (
      <>
        <Header title="Калькулятор" subtitle="Расчёт растаможки автомобиля" />
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Калькулятор" subtitle="Растаможка и утильсбор по правилам 2026 года" />
      <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
        <CustomsCalculator />
        {/* Быстрый поиск (Tavily) скрыт, пока на сервере нет зарубежного прокси */}
      </div>
    </>
  );
}
