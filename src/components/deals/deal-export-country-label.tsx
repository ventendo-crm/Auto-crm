"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import {
  resolveOriginLabel,
  type CustomCalculatorOrigin,
} from "@/lib/customs-calculator/custom-origins";

/** Подпись страны экспорта сделки с учётом кастомных стран компании. */
export function DealExportCountryLabel({ value }: { value: string }) {
  const [customOrigins, setCustomOrigins] = useState<CustomCalculatorOrigin[]>([]);

  useEffect(() => {
    let cancelled = false;
    void api.calculatorExpenseTemplate
      .get()
      .then((settings) => {
        if (!cancelled) setCustomOrigins(settings.customOrigins ?? []);
      })
      .catch(() => {
        if (!cancelled) setCustomOrigins([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <>{resolveOriginLabel(value, customOrigins)}</>;
}
