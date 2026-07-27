"use client";

import { Loader2, Plus } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { ADDITIONAL_OPTION_GROUPS } from "@/lib/additional-options";
import { api } from "@/lib/api-client";
import {
  canCreateCustomAdditionalOption,
  getClientRoleName,
} from "@/lib/permissions";
import {
  AdditionalOptionGroupState,
  AdditionalOptionState,
} from "@/lib/services/additional-options";
import { cn, formatDateTime } from "@/lib/utils";

interface DealAdditionalOptionsProps {
  dealId: string;
  managerId?: string | null;
  managerIds?: string[];
  onChanged?: () => void;
}

function countChecked(groups: AdditionalOptionGroupState[]): number {
  return groups.reduce(
    (sum, group) => sum + group.options.filter((option) => option.checked).length,
    0,
  );
}

export function DealAdditionalOptions({
  dealId,
  managerId = null,
  managerIds = [],
  onChanged,
}: DealAdditionalOptionsProps) {
  const { user } = useAuth();
  const role = getClientRoleName(user);
  const canAddCustom =
    role && user
      ? canCreateCustomAdditionalOption(role, user.id, {
          managerId,
          managerIds: managerIds.length > 0 ? managerIds : managerId ? [managerId] : [],
        })
      : false;

  const [groups, setGroups] = useState<AdditionalOptionGroupState[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newGroupId, setNewGroupId] = useState(ADDITIONAL_OPTION_GROUPS[0]?.id ?? "");

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
      toast.error(err instanceof Error ? err.message : "Не удалось обновить опцию");
    } finally {
      setPendingKeys((current) => {
        const next = new Set(current);
        next.delete(optionKey);
        return next;
      });
    }
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const label = newLabel.trim();
    if (!label || !newGroupId) return;

    setCreating(true);
    try {
      await api.deals.additionalOptions.create(dealId, {
        label,
        groupId: newGroupId,
      });
      toast.success("Опция добавлена");
      setNewLabel("");
      setFormOpen(false);
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось добавить опцию");
    } finally {
      setCreating(false);
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
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="text-base">Дополнительные опции</CardTitle>
          <p className="text-sm text-muted-foreground">
            Отметьте услуги, которые хотели бы установить. Не все опции доступны для каждого
            автомобиля — уточняйте возможность установки у менеджера. Выбрано: {checkedCount}
          </p>
        </div>
        {canAddCustom && !formOpen && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setFormOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Добавить опцию
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-8">
        {canAddCustom && formOpen && (
          <form
            onSubmit={(event) => void handleCreate(event)}
            className="space-y-3 rounded-xl border bg-muted/20 p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="custom-option-label">Название</Label>
                <Input
                  id="custom-option-label"
                  value={newLabel}
                  onChange={(event) => setNewLabel(event.target.value)}
                  placeholder="Введите название опции"
                  maxLength={200}
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Категория</Label>
                <Select value={newGroupId} onValueChange={setNewGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent>
                    {ADDITIONAL_OPTION_GROUPS.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="brand" size="sm" disabled={creating || !newLabel.trim()}>
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Сохранить
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={creating}
                onClick={() => {
                  setFormOpen(false);
                  setNewLabel("");
                }}
              >
                Отмена
              </Button>
            </div>
          </form>
        )}

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
