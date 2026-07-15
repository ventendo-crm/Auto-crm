"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function formatSelectedLabel(managers: User[], value: string[]): string {
  if (value.length === 0) {
    return "Выберите менеджеров";
  }

  const selectedNames = managers
    .filter((manager) => value.includes(manager.id))
    .map((manager) => manager.name);

  return selectedNames.length > 0 ? selectedNames.join(", ") : "Выберите менеджеров";
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

  const triggerLabel = useMemo(() => formatSelectedLabel(managers, value), [managers, value]);

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
    return <Skeleton className="h-9 w-full" />;
  }

  if (managers.length === 0) {
    return <p className="text-sm text-muted-foreground">Менеджеры не найдены</p>;
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        id={id}
        disabled={disabled}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left",
            value.length === 0 && "text-muted-foreground",
          )}
        >
          {triggerLabel}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="z-[110] max-h-64 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
      >
        {managers.map((manager) => (
          <DropdownMenuCheckboxItem
            key={manager.id}
            checked={value.includes(manager.id)}
            disabled={disabled}
            onCheckedChange={(checked) => toggleManager(manager.id, checked === true)}
            onSelect={(event) => event.preventDefault()}
          >
            {manager.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
