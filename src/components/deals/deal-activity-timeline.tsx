import {
  ArrowRightLeft,
  ClipboardList,
  FileText,
  ImageIcon,
  MessageSquare,
  Search,
  UserRound,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function DealActivityTimeline({ activity }: { activity: DealActivityItem[] }) {
  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="text-base">История изменений</CardTitle>
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
            <p className="text-sm text-muted-foreground">История пуста</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
