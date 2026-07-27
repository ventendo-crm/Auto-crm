import { Prisma } from "@prisma/client";
import {
  calculateCustoms,
  CustomsCalculatorInput,
  CustomsCalculatorResult,
} from "@/lib/customs-calculator";
import { AuthUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/audit";
import { createCustomsEstimateSchema } from "@/lib/validators/customs-estimate";
import { z } from "zod";

type CreateInput = z.infer<typeof createCustomsEstimateSchema>;

export interface DealCustomsEstimateItem {
  id: string;
  dealId: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  note: string | null;
  totalWithCar: number;
  input: CustomsCalculatorInput;
  result: CustomsCalculatorResult;
}

function serializeEstimate(record: {
  id: string;
  dealId: string;
  createdById: string;
  createdAt: Date;
  note: string | null;
  totalWithCar: Prisma.Decimal;
  input: Prisma.JsonValue;
  result: Prisma.JsonValue;
  createdBy: { name: string };
}): DealCustomsEstimateItem {
  return {
    id: record.id,
    dealId: record.dealId,
    createdById: record.createdById,
    createdByName: record.createdBy.name,
    createdAt: record.createdAt.toISOString(),
    note: record.note,
    totalWithCar: Number(record.totalWithCar),
    input: record.input as unknown as CustomsCalculatorInput,
    result: record.result as unknown as CustomsCalculatorResult,
  };
}

export async function listDealCustomsEstimates(
  dealId: string,
): Promise<DealCustomsEstimateItem[]> {
  const records = await prisma.dealCustomsEstimate.findMany({
    where: { dealId },
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return records.map(serializeEstimate);
}

export async function createDealCustomsEstimate(
  user: AuthUser,
  dealId: string,
  body: CreateInput,
): Promise<DealCustomsEstimateItem> {
  const result = calculateCustoms(body.input);
  if (!result) {
    throw new Error("INVALID_CALCULATION");
  }

  const created = await prisma.dealCustomsEstimate.create({
    data: {
      dealId,
      createdById: user.id,
      input: body.input as unknown as Prisma.InputJsonValue,
      result: result as unknown as Prisma.InputJsonValue,
      totalWithCar: new Prisma.Decimal(result.totalWithCar),
      note: body.note?.trim() || null,
    },
    include: { createdBy: { select: { name: true } } },
  });

  await createAuditLog({
    userId: user.id,
    entity: "DealCustomsEstimate",
    entityId: created.id,
    action: "CREATE",
    newValue: {
      dealId,
      totalWithCar: Number(created.totalWithCar),
      note: created.note,
    },
  });

  return serializeEstimate(created);
}

export async function deleteDealCustomsEstimate(
  user: AuthUser,
  dealId: string,
  estimateId: string,
): Promise<void> {
  const existing = await prisma.dealCustomsEstimate.findFirst({
    where: { id: estimateId, dealId },
    select: { id: true, note: true, totalWithCar: true },
  });

  if (!existing) {
    throw new Error("NOT_FOUND");
  }

  await prisma.dealCustomsEstimate.delete({ where: { id: existing.id } });

  await createAuditLog({
    userId: user.id,
    entity: "DealCustomsEstimate",
    entityId: existing.id,
    action: "DELETE",
    oldValue: {
      dealId,
      totalWithCar: Number(existing.totalWithCar),
      note: existing.note,
    },
  });
}
