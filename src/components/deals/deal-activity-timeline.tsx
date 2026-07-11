"use client";

import {
  ArrowRightLeft,
  ClipboardList,
  FileText,
  ImageIcon,
  Loader2,
  MessageSquare,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DealActivityItem } from "@/lib/services/deal-activity";
import { cn, formatDateTime } from "@/lib/utils";

const categoryIcons = {
  stage: ArrowRightLeft,
  deal: UserRound,
  document: FileText,
  media: ImageIcon,
  search: Search,
  comment: MessageSquare,
  options: ClipboardList,
} as const;

const categoryColors = {
  stage: "border-brand text-brand",
  deal: "border-blue-500 text-blue-500",
  document: "border-amber-500 text-amber-500",
  media: "border-violet-500 text-violet-500",
  search: "border-emerald-500 text-emerald-500",
  comment: "border-slate-500 text-slate-500",
  options: "border-orange-500 text-orange-500",
} as const;

interface DealActivityTimelineProps {
  activity: DealActivityItem[];
  canClear?: boolean;
  onClear?: () => Promise<void>;
}

export function DealActivityTimeline({
  activity,
  canClear = false,
  onClear,
}: DealActivityTimelineProps) {
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    if (
      !confirm(
        "Очистить всю историю изменений по этой сделке? Действие необратимо.",
      )
    ) {
      return;
    }

    if (!onClear) return;

    setClearing(true);
    try {
      await onClear();
      toast.success("История очищена");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось очистить историю");
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <CardTitle className="text-base">История изменений</CardTitle>
        {canClear && activity.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 text-destructive hover:text-destructive"
            disabled={clearing}
            onClick={() => void handleClear()}
          >
            {clearing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Очистить
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {activity.map((item, index) => {
            const Icon = categoryIcons[item.category];
            const color = categoryColors[item.category];

            return (
              <div key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
                {index < activity.length - 1 && (
                  <div className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-border" />
                )}

                <div
                  className={cn(
                    "relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-background",
                    color,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.user.name} · {formatDateTime(item.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}

          {activity.length === 0 && (
            <EmptyState
              icon={ClipboardList}
              title="История пуста"
              description="Здесь появятся изменения этапа, загрузки документов и другие действия по сделке."
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
