"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { User } from "@/lib/types";

const ADD_MANAGER_VALUE = "__add_manager__";

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

  const selectedManagers = managers.filter((manager) => value.includes(manager.id));
  const availableManagers = managers.filter((manager) => !value.includes(manager.id));

  const addManager = (managerId: string) => {
    if (!managerId || value.includes(managerId)) return;
    onValueChange([...value, managerId]);
  };

  const removeManager = (managerId: string) => {
    onValueChange(value.filter((id) => id !== managerId));
  };

  if (loading) {
    return <Skeleton className="h-9 w-full" />;
  }

  return (
    <div className={className ?? "space-y-2"}>
      <div className="flex min-h-9 flex-wrap items-center gap-2 rounded-md border bg-background px-2 py-1.5">
        {selectedManagers.length > 0 ? (
          selectedManagers.map((manager) => (
            <Badge key={manager.id} variant="secondary" className="gap-1 pr-1">
              {manager.name}
              {!disabled && (
                <button
                  type="button"
                  className="rounded-sm p-0.5 hover:bg-muted"
                  onClick={() => removeManager(manager.id)}
                  aria-label={`Убрать ${manager.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">Менеджеры не назначены</span>
        )}
      </div>

      {!disabled && availableManagers.length > 0 && (
        <Select
          value={ADD_MANAGER_VALUE}
          onValueChange={(next) => {
            if (next !== ADD_MANAGER_VALUE) {
              addManager(next);
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder="Добавить менеджера" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value={ADD_MANAGER_VALUE} disabled>
              Добавить менеджера
            </SelectItem>
            {availableManagers.map((manager) => (
              <SelectItem key={manager.id} value={manager.id}>
                {manager.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
