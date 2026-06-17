import { getAdditionalOptionLabel, ADDITIONAL_OPTION_GROUPS } from "@/lib/additional-options";
import { prisma } from "@/lib/prisma";
import { AuthUser } from "@/lib/permissions";
import { createAuditLog } from "@/lib/services/audit";
import { serialize } from "@/lib/serialize";
export interface AdditionalOptionState {
  key: string;
  label: string;
  checked: boolean;
  updatedAt: string | null;
  updatedBy: { id: string; name: string } | null;
}

export interface AdditionalOptionGroupState {
  id: string;
  title: string;
  options: AdditionalOptionState[];
}

export async function listAdditionalOptions(dealId: string): Promise<AdditionalOptionGroupState[]> {
  const records = await prisma.dealAdditionalOption.findMany({
    where: { dealId },
    include: {
      updatedBy: { select: { id: true, name: true } },
    },
  });

  const recordMap = new Map(records.map((record) => [record.optionKey, record]));

  return ADDITIONAL_OPTION_GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    options: group.options.map((option) => {
      const record = recordMap.get(option.key);
      return {
        key: option.key,
        label: option.label,
        checked: record?.checked ?? false,
        updatedAt: record?.updatedAt.toISOString() ?? null,
        updatedBy: record?.updatedBy ?? null,
      };
    }),
  }));
}

export async function toggleAdditionalOption(
  user: AuthUser,
  dealId: string,
  optionKey: string,
  checked: boolean,
) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { id: true } });
  if (!deal) {
    throw new Error("NOT_FOUND");
  }

  const existing = await prisma.dealAdditionalOption.findUnique({
    where: {
      dealId_optionKey: { dealId, optionKey },
    },
  });

  const previousChecked = existing?.checked ?? false;
  const optionLabel = getAdditionalOptionLabel(optionKey);

  const record = await prisma.dealAdditionalOption.upsert({
    where: {
      dealId_optionKey: { dealId, optionKey },
    },
    create: {
      dealId,
      optionKey,
      checked,
      updatedById: user.id,
    },
    update: {
      checked,
      updatedById: user.id,
    },
    include: {
      updatedBy: { select: { id: true, name: true } },
    },
  });

  if (previousChecked !== checked) {
    await createAuditLog({
      userId: user.id,
      entity: "DealAdditionalOption",
      entityId: record.id,
      action: checked ? "CHECK" : "UNCHECK",
      oldValue: { dealId, optionKey, optionLabel, checked: previousChecked },
      newValue: { dealId, optionKey, optionLabel, checked },
    });
  }

  return serialize(record);
}
