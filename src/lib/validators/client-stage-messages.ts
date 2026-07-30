import { DealStageType } from "@prisma/client";
import { z } from "zod";
import { STAGE_ORDER } from "@/lib/constants";

const stageEnum = z.nativeEnum(DealStageType);

export const updateClientStageMessagesSchema = z.object({
  messages: z
    .array(
      z.object({
        stage: stageEnum,
        textBody: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(STAGE_ORDER.length)
    .refine(
      (items) => new Set(items.map((item) => item.stage)).size === items.length,
      "Этапы в списке не должны повторяться",
    ),
});
