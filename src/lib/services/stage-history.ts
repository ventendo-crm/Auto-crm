import { DealStageType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function listStageHistory(dealId: string) {
  return prisma.stageHistory.findMany({
    where: { dealId },
    orderBy: { createdAt: "desc" },
    include: {
      changedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

export async function recordStageChange(params: {
  dealId: string;
  fromStage: DealStageType;
  toStage: DealStageType;
  changedById: string;
}) {
  return prisma.stageHistory.create({
    data: {
      dealId: params.dealId,
      fromStage: params.fromStage,
      toStage: params.toStage,
      changedById: params.changedById,
    },
    include: {
      changedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}
