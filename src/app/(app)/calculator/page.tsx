"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calculator, Share2 } from "lucide-react";
import { CalculatorOfferWorkspace } from "@/components/calculator/calculator-offer-workspace";
import { CalculatorQuickSearch } from "@/components/calculator/calculator-quick-search";
import { CustomsCalculator } from "@/components/calculator/customs-calculator";
import { Header } from "@/components/layout/header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useCompanyWorkspace } from "@/hooks/use-company-workspace";
import { canAccessCalculator, getClientRoleName } from "@/lib/permissions";

function CalculatorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "calc" ? "calc" : "offer";

  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "offer") next.delete("tab");
    else next.set("tab", value);
    const query = next.toString();
    router.replace(query ? `/calculator?${query}` : "/calculator", { scroll: false });
  };

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList className="grid h-auto w-full grid-cols-2">
        <TabsTrigger value="offer" className="gap-1.5">
          <Share2 className="h-3.5 w-3.5" />
          Подбор
        </TabsTrigger>
        <TabsTrigger value="calc" className="gap-1.5">
          <Calculator className="h-3.5 w-3.5" />
          Калькулятор
        </TabsTrigger>
      </TabsList>

      <TabsContent value="offer" className="mt-4">
        <CalculatorOfferWorkspace />
      </TabsContent>

      <TabsContent value="calc" className="mt-4 space-y-6">
        <CustomsCalculator />
        <CalculatorQuickSearch />
      </TabsContent>
    </Tabs>
  );
}

export default function CalculatorPage() {
  const { user, loading } = useAuth();
  const { settings } = useCompanyWorkspace();
  const router = useRouter();
  const role = getClientRoleName(user);
  const allowed = role ? canAccessCalculator(role, settings.modules.calculator) : false;

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
        <div className="page-content space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Калькулятор" subtitle="Подбор авто и расчёт растаможки" />
      <div className="page-content">
        <Suspense
          fallback={
            <div className="space-y-4">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-96 w-full rounded-xl" />
            </div>
          }
        >
          <CalculatorContent />
        </Suspense>
      </div>
    </>
  );
}
