"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { User } from "@/lib/types";

interface ManagersMultiSelectProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function ManagersMultiSelect({
  value,
  onValueChange,
  disabled,
  id,
  className,
}: ManagersMultiSelectProps) {
  const [managers, setManagers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.users
      .list()
      .then((users) => setManagers(users.filter((user) => user.role.name === "MANAGER")))
      .catch(() => setManagers([]))
      .finally(() => setLoading(false));
  }, []);

  const toggleManager = (managerId: string, checked: boolean) => {
    if (checked) {
      if (!value.includes(managerId)) {
        onValueChange([...value, managerId]);
      }
      return;
    }

    onValueChange(value.filter((id) => id !== managerId));
  };

  if (loading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (managers.length === 0) {
    return <p className="text-sm text-muted-foreground">Менеджеры не найдены</p>;
  }

  return (
    <div
      id={id}
      role="group"
      aria-label="Менеджеры"
      className={cn("rounded-md border bg-background", disabled && "opacity-70", className)}
    >
      <ul className="max-h-48 divide-y overflow-y-auto">
        {managers.map((manager) => {
          const isChecked = value.includes(manager.id);

          return (
            <li key={manager.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors",
                  isChecked ? "bg-primary/5" : "hover:bg-muted/40",
                  disabled && "cursor-default hover:bg-transparent",
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 rounded border-input accent-primary"
                  checked={isChecked}
                  disabled={disabled}
                  onChange={(event) => toggleManager(manager.id, event.target.checked)}
                />
                <span className="text-sm">{manager.name}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
