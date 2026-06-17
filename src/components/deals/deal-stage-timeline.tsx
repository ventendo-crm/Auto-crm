import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STAGE_LABELS } from "@/lib/constants";
import { StageHistoryItem } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function DealStageTimeline({ history }: { history: StageHistoryItem[] }) {
  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="text-base">История этапов</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {history.map((item, index) => (
            <div key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
              {index < history.length - 1 && (
                <div className="absolute left-[7px] top-4 h-full w-px bg-border" />
              )}
              <div className="relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-brand bg-background" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{STAGE_LABELS[item.fromStage]}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium text-brand">{STAGE_LABELS[item.toStage]}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.changedBy.name} · {formatDateTime(item.createdAt)}
                </p>
              </div>
            </div>
          ))}
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground">История пуста</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
