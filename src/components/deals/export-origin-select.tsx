"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import {
  buildOriginOptions,
  coerceOriginSelectValue,
  type CustomCalculatorOrigin,
} from "@/lib/customs-calculator/custom-origins";

interface ExportOriginSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export function ExportOriginSelect({
  value,
  onValueChange,
  id,
  disabled,
  className,
}: ExportOriginSelectProps) {
  const [customOrigins, setCustomOrigins] = useState<CustomCalculatorOrigin[]>([]);

  useEffect(() => {
    let cancelled = false;
    void api.calculatorExpenseTemplate
      .get()
      .then((settings) => {
        if (!cancelled) {
          setCustomOrigins(settings.customOrigins ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setCustomOrigins([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(() => {
    const base = buildOriginOptions(customOrigins);
    const coerced = coerceOriginSelectValue(value, customOrigins);
    if (coerced && !base.some((option) => option.value === coerced)) {
      return [...base, { value: coerced, label: coerced }];
    }
    return base;
  }, [customOrigins, value]);

  const selectValue = coerceOriginSelectValue(value, customOrigins);

  return (
    <Select value={selectValue} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder="Страна экспорта" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
