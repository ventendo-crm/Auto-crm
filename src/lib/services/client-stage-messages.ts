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

export async function ensureClientStageMessages(companyId: string): Promise<void> {
  for (const stage of STAGE_ORDER) {
    await prisma.clientStageMessage.upsert({
      where: {
        companyId_stage: { companyId, stage },
      },
      create: {
        companyId,
        stage,
        textBody: CLIENT_STAGE_NOTIFICATIONS[stage],
        updatedAt: new Date(),
      },
      update: {},
    });
  }
}

export async function listClientStageMessages(
  companyId: string,
): Promise<ClientStageMessageRecord[]> {
  await ensureClientStageMessages(companyId);

  const items = await prisma.clientStageMessage.findMany({ where: { companyId } });
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

export async function getClientStageMessage(
  companyId: string,
  stage: DealStageType,
): Promise<string> {
  await ensureClientStageMessages(companyId);

  const record = await prisma.clientStageMessage.findUnique({
    where: { companyId_stage: { companyId, stage } },
  });
  return record?.textBody?.trim() || CLIENT_STAGE_NOTIFICATIONS[stage];
}

export async function updateClientStageMessages(
  companyId: string,
  updates: Array<{ stage: DealStageType; textBody: string }>,
  updatedById: string,
): Promise<ClientStageMessageRecord[]> {
  await ensureClientStageMessages(companyId);

  for (const item of updates) {
    await prisma.clientStageMessage.update({
      where: { companyId_stage: { companyId, stage: item.stage } },
      data: {
        textBody: item.textBody.trim(),
        updatedById,
      },
    });
  }

  return listClientStageMessages(companyId);
}
