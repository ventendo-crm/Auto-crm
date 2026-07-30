import { DealStageType } from "@prisma/client";
import { CLIENT_STAGE_NOTIFICATIONS, STAGE_LABELS, STAGE_ORDER } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export interface ClientStageMessageRecord {
  stage: DealStageType;
  label: string;
  textBody: string;
  updatedAt: Date;
  updatedById: string | null;
}

export async function ensureClientStageMessages(): Promise<void> {
  for (const stage of STAGE_ORDER) {
    await prisma.clientStageMessage.upsert({
      where: { stage },
      create: {
        stage,
        textBody: CLIENT_STAGE_NOTIFICATIONS[stage],
        updatedAt: new Date(),
      },
      update: {},
    });
  }
}

export async function listClientStageMessages(): Promise<ClientStageMessageRecord[]> {
  await ensureClientStageMessages();

  const items = await prisma.clientStageMessage.findMany();
  const byStage = new Map(items.map((item) => [item.stage, item]));

  return STAGE_ORDER.map((stage) => {
    const record = byStage.get(stage);
    return {
      stage,
      label: STAGE_LABELS[stage],
      textBody: record?.textBody ?? CLIENT_STAGE_NOTIFICATIONS[stage],
      updatedAt: record?.updatedAt ?? new Date(),
      updatedById: record?.updatedById ?? null,
    };
  });
}

export async function getClientStageMessage(stage: DealStageType): Promise<string> {
  await ensureClientStageMessages();

  const record = await prisma.clientStageMessage.findUnique({ where: { stage } });
  return record?.textBody?.trim() || CLIENT_STAGE_NOTIFICATIONS[stage];
}

export async function updateClientStageMessages(
  updates: Array<{ stage: DealStageType; textBody: string }>,
  updatedById: string,
): Promise<ClientStageMessageRecord[]> {
  await ensureClientStageMessages();

  for (const item of updates) {
    await prisma.clientStageMessage.update({
      where: { stage: item.stage },
      data: {
        textBody: item.textBody.trim(),
        updatedById,
      },
    });
  }

  return listClientStageMessages();
}
