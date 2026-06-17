"use client";

import { useEffect, useState } from "react";
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

interface ManagerSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function ManagerSelect({
  value,
  onValueChange,
  disabled,
  id,
  className,
}: ManagerSelectProps) {
  const [managers, setManagers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.users
      .list()
      .then((users) => setManagers(users.filter((user) => user.role.name === "MANAGER")))
      .catch(() => setManagers([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Skeleton className="h-9 w-full max-w-xs" />;
  }

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled || managers.length === 0}>
      <SelectTrigger id={id} className={className ?? "w-full max-w-xs"}>
        <SelectValue placeholder="Выберите менеджера" />
      </SelectTrigger>
      <SelectContent>
        {managers.map((manager) => (
          <SelectItem key={manager.id} value={manager.id}>
            {manager.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
