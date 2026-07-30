import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface AuditParams {
  userId: string;
  entity: string;
  entityId: string;
  action: string;
  companyId?: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
}

export async function createAuditLog(params: AuditParams) {
  let companyId = params.companyId;
  if (!companyId) {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { companyId: true },
    });
    companyId = user?.companyId;
  }

  if (!companyId) {
    throw new Error("Cannot create audit log without companyId");
  }

  return prisma.auditLog.create({
    data: {
      companyId,
      userId: params.userId,
      entity: params.entity,
      entityId: params.entityId,
      action: params.action,
      oldValue: params.oldValue,
      newValue: params.newValue,
    },
  });
}
