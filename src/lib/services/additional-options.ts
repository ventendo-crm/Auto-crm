import {
  ADDITIONAL_OPTION_GROUPS,
  createCustomAdditionalOptionKey,
  getAdditionalOptionLabel,
  isCustomAdditionalOptionKey,
  isValidAdditionalOptionKey,
} from "@/lib/additional-options";
import { prisma } from "@/lib/prisma";
import { AuthUser } from "@/lib/permissions";
import { createAuditLog } from "@/lib/services/audit";
import { serialize } from "@/lib/serialize";

export interface AdditionalOptionState {
  key: string;
  label: string;
  checked: boolean;
  isCustom: boolean;
  updatedAt: string | null;
  updatedBy: { id: string; name: string } | null;
}

export interface AdditionalOptionGroupState {
  id: string;
  title: string;
  options: AdditionalOptionState[];
}

function toOptionState(input: {
  key: string;
  label: string;
  checked: boolean;
  isCustom: boolean;
  updatedAt?: Date | null;
  updatedBy?: { id: string; name: string } | null;
}): AdditionalOptionState {
  return {
    key: input.key,
    label: input.label,
    checked: input.checked,
    isCustom: input.isCustom,
    updatedAt: input.updatedAt?.toISOString() ?? null,
    updatedBy: input.updatedBy ?? null,
  };
}

export async function listAdditionalOptions(dealId: string): Promise<AdditionalOptionGroupState[]> {
  const records = await prisma.dealAdditionalOption.findMany({
    where: { dealId },
    include: {
      updatedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const recordMap = new Map(records.map((record) => [record.optionKey, record]));
  const customByGroup = new Map<string, typeof records>();

  for (const record of records) {
    if (!record.isCustom || !record.groupId) continue;
    const list = customByGroup.get(record.groupId) ?? [];
    list.push(record);
    customByGroup.set(record.groupId, list);
  }

  return ADDITIONAL_OPTION_GROUPS.map((group) => {
    const staticOptions = group.options.map((option) => {
      const record = recordMap.get(option.key);
      return toOptionState({
        key: option.key,
        label: option.label,
        checked: record?.checked ?? false,
        isCustom: false,
        updatedAt: record?.updatedAt ?? null,
        updatedBy: record?.updatedBy ?? null,
      });
    });

    const customOptions = (customByGroup.get(group.id) ?? []).map((record) =>
      toOptionState({
        key: record.optionKey,
        label: record.label?.trim() || getAdditionalOptionLabel(record.optionKey),
        checked: record.checked,
        isCustom: true,
        updatedAt: record.updatedAt,
        updatedBy: record.updatedBy,
      }),
    );

    return {
      id: group.id,
      title: group.title,
      options: [...staticOptions, ...customOptions],
    };
  });
}

export async function createCustomAdditionalOption(
  user: AuthUser,
  dealId: string,
  label: string,
  groupId: string,
) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { id: true } });
  if (!deal) {
    throw new Error("NOT_FOUND");
  }

  const optionKey = createCustomAdditionalOptionKey();
  const trimmedLabel = label.trim();

  const record = await prisma.dealAdditionalOption.create({
    data: {
      dealId,
      optionKey,
      label: trimmedLabel,
      groupId,
      isCustom: true,
      checked: true,
      updatedById: user.id,
    },
    include: {
      updatedBy: { select: { id: true, name: true } },
    },
  });

  await createAuditLog({
    userId: user.id,
    entity: "DealAdditionalOption",
    entityId: record.id,
    action: "CREATE",
    newValue: {
      dealId,
      optionKey,
      optionLabel: trimmedLabel,
      groupId,
      checked: true,
      isCustom: true,
    },
  });

  return serialize(record);
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

  if (isCustomAdditionalOptionKey(optionKey)) {
    if (!existing?.isCustom) {
      throw new Error("UNKNOWN_OPTION");
    }
  } else if (!isValidAdditionalOptionKey(optionKey)) {
    throw new Error("UNKNOWN_OPTION");
  }

  const previousChecked = existing?.checked ?? false;
  const optionLabel = getAdditionalOptionLabel(optionKey, existing?.label);

  const record = await prisma.dealAdditionalOption.upsert({
    where: {
      dealId_optionKey: { dealId, optionKey },
    },
    create: {
      dealId,
      optionKey,
      checked,
      updatedById: user.id,
      isCustom: false,
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
