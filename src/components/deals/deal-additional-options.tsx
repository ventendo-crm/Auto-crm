"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import {
  AdditionalOptionGroupState,
  AdditionalOptionState,
} from "@/lib/services/additional-options";
import { cn, formatDateTime } from "@/lib/utils";

interface DealAdditionalOptionsProps {
  dealId: string;
  onChanged?: () => void;
}

function countChecked(groups: AdditionalOptionGroupState[]): number {
  return groups.reduce(
    (sum, group) => sum + group.options.filter((option) => option.checked).length,
    0,
  );
}

export function DealAdditionalOptions({ dealId, onChanged }: DealAdditionalOptionsProps) {
  const [groups, setGroups] = useState<AdditionalOptionGroupState[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());

  const checkedCount = useMemo(() => countChecked(groups), [groups]);

  const load = useCallback(async () => {
    try {
      const data = await api.deals.additionalOptions.list(dealId);
      setGroups(data);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Не удалось загрузить дополнительные опции",
      );
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateOption = (
    optionKey: string,
    updater: (option: AdditionalOptionState) => AdditionalOptionState,
  ) => {
    setGroups((current) =>
      current.map((group) => ({
        ...group,
        options: group.options.map((option) =>
          option.key === optionKey ? updater(option) : option,
        ),
      })),
    );
  };

  const handleToggle = async (optionKey: string, checked: boolean) => {
    const previousGroups = groups;

    setPendingKeys((current) => new Set(current).add(optionKey));
    updateOption(optionKey, (option) => ({ ...option, checked }));

    try {
      const record = await api.deals.additionalOptions.toggle(dealId, optionKey, checked);
      updateOption(optionKey, (option) => ({
        ...option,
        checked: record.checked,
        updatedAt: record.updatedAt,
        updatedBy: record.updatedBy,
      }));
      onChanged?.();
    } catch (err) {
      setGroups(previousGroups);
      toast.error(
        err instanceof Error ? err.message : "Не удалось обновить опцию",
      );
    } finally {
      setPendingKeys((current) => {
        const next = new Set(current);
        next.delete(optionKey);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-card">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="text-base">Дополнительные опции</CardTitle>
        <p className="text-sm text-muted-foreground">
          Отметьте услуги, которые хотели бы установить. Не все опции доступны для каждого
          автомобиля — уточняйте возможность установки у менеджера. Выбрано: {checkedCount}
        </p>
      </CardHeader>
      <CardContent className="space-y-8">
        {groups.map((group) => (
          <section key={group.id} className="space-y-3">
            <h3 className="text-sm font-semibold">{group.title}</h3>
            <ul className="space-y-2">
              {group.options.map((option) => {
                const isPending = pendingKeys.has(option.key);

                return (
                  <li key={option.key}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                        option.checked
                          ? "border-primary/30 bg-primary/5"
                          : "hover:bg-muted/40",
                        isPending && "opacity-70",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
                        checked={option.checked}
                        disabled={isPending}
                        onChange={(event) =>
                          void handleToggle(option.key, event.target.checked)
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-sm leading-snug">{option.label}</span>
                        {option.checked && option.updatedBy && option.updatedAt && (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {option.updatedBy.name} · {formatDateTime(option.updatedAt)}
                          </span>
                        )}
                      </span>
                      {isPending && (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

export { countChecked as countCheckedAdditionalOptions };
