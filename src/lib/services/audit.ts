import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface AuditParams {
  userId: string;
  entity: string;
  entityId: string;
  action: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
}

export async function createAuditLog(params: AuditParams) {
  return prisma.auditLog.create({
    data: {
      userId: params.userId,
      entity: params.entity,
      entityId: params.entityId,
      action: params.action,
      oldValue: params.oldValue,
      newValue: params.newValue,
    },
  });
}
