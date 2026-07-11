"use client";

import { DealStageType } from "@prisma/client";
import { Check } from "lucide-react";
import {
  CLIENT_STAGE_SHORT_LABELS,
  STAGE_ACCENT_BG,
  STAGE_ACCENT_BORDER,
  STAGE_ORDER,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ClientDealProgressProps {
  currentStage: DealStageType;
  stageLabel: string;
  className?: string;
}

export function ClientDealProgress({
  currentStage,
  stageLabel,
  className,
}: ClientDealProgressProps) {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);

  return (
    <div className={cn("surface-muted p-4", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-section-title">Прогресс импорта</p>
        <p className="text-sm text-muted-foreground">
          Сейчас: <span className="font-medium text-foreground">{stageLabel}</span>
        </p>
      </div>

      <div className="-mx-1 overflow-x-auto pb-1">
        <div className="flex min-w-max items-start px-1">
          {STAGE_ORDER.map((stage, index) => {
            const isComplete = currentIndex >= 0 && index < currentIndex;
            const isCurrent = stage === currentStage;
            const isUpcoming = currentIndex >= 0 && index > currentIndex;

            return (
              <div key={stage} className="flex items-start">
                <div className="flex w-[4.5rem] flex-col items-center sm:w-[5.5rem]">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors duration-normal",
                      isComplete && cn("text-white", STAGE_ACCENT_BORDER[stage], STAGE_ACCENT_BG[stage]),
                      isCurrent && cn("bg-background", STAGE_ACCENT_BORDER[stage]),
                      isUpcoming && "border-muted-foreground/30 bg-background",
                    )}
                  >
                    {isComplete ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : isCurrent ? (
                      <span className={cn("h-2.5 w-2.5 rounded-full", STAGE_ACCENT_BG[stage])} />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>
                  <p
                    className={cn(
                      "mt-1.5 text-center text-micro",
                      isCurrent && "font-semibold text-foreground",
                      isComplete && "text-muted-foreground",
                      isUpcoming && "text-muted-foreground/70",
                    )}
                  >
                    {CLIENT_STAGE_SHORT_LABELS[stage]}
                  </p>
                </div>

                {index < STAGE_ORDER.length - 1 && (
                  <div
                    className={cn(
                      "mt-3.5 h-0.5 w-4 shrink-0 transition-colors duration-normal sm:w-6",
                      isComplete ? STAGE_ACCENT_BG[stage] : "bg-muted-foreground/20",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
