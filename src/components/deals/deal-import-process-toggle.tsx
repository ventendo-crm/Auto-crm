"use client";

import { Loader2, Ship } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";

interface DealImportProcessToggleProps {
  dealId: string;
  enabled: boolean;
  canManage?: boolean;
  onChanged?: () => void;
}

export function DealImportProcessToggle({
  dealId,
  enabled,
  canManage = false,
  onChanged,
}: DealImportProcessToggleProps) {
  const [loading, setLoading] = useState(false);

  if (!canManage) {
    return null;
  }

  const handleToggle = async (nextEnabled: boolean) => {
    setLoading(true);
    try {
      await api.deals.setImportProcessEnabled(dealId, nextEnabled);
      onChanged?.();
      toast.success(
        nextEnabled
          ? "Вкладка «Процесс импорта авто» активирована"
          : "Вкладка «Процесс импорта авто» скрыта",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось изменить настройку");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Ship className="h-4 w-4" />
            Процесс импорта авто
          </CardTitle>
          <Badge variant={enabled ? "default" : "secondary"}>
            {enabled ? "Активна" : "Скрыта"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {enabled
            ? "Клиент видит вкладку «Процесс импорта авто» в личном кабинете."
            : "Вкладка скрыта у клиента и сотрудников до активации."}
        </p>

        <Button
          type="button"
          variant={enabled ? "outline" : "brand"}
          disabled={loading}
          onClick={() => void handleToggle(!enabled)}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : enabled ? (
            "Скрыть вкладку"
          ) : (
            "Активировать вкладку"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
