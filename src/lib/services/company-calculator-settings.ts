import { Prisma } from "@prisma/client";
import {
  createCustomOriginId,
  ensureUniqueCustomOriginId,
  normalizeCustomOrigins,
  type CustomCalculatorOrigin,
} from "@/lib/customs-calculator/custom-origins";
import {
  CalculatorExpenseItem,
  createExpenseItemId,
  getDefaultCompanyCalculatorExpenses,
  sortExpenseItems,
} from "@/lib/customs-calculator/expense-template";
import { prisma } from "@/lib/prisma";
import type {
  CalculatorExpenseItemInput,
  CustomCalculatorOriginInput,
} from "@/lib/validators/company-calculator-settings";

export interface CompanyCalculatorSettingsDto {
  companyId: string;
  expenseItems: CalculatorExpenseItem[];
  customOrigins: CustomCalculatorOrigin[];
  updatedAt: string | null;
}

function normalizeItems(value: Prisma.JsonValue | null | undefined): CalculatorExpenseItem[] {
  const defaults = getDefaultCompanyCalculatorExpenses();
  if (!Array.isArray(value) || value.length === 0) {
    return defaults;
  }

  const items: CalculatorExpenseItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<CalculatorExpenseItem>;
    if (
      typeof item.id !== "string" ||
      typeof item.label !== "string" ||
      typeof item.defaultAmount !== "number" ||
      typeof item.currency !== "string" ||
      typeof item.origin !== "string" ||
      typeof item.role !== "string" ||
      typeof item.sortOrder !== "number"
    ) {
      continue;
    }
    items.push({
      id: item.id,
      label: item.label,
      defaultAmount: item.defaultAmount,
      currency: item.currency as CalculatorExpenseItem["currency"],
      origin: item.origin as CalculatorExpenseItem["origin"],
      role: item.role as CalculatorExpenseItem["role"],
      sortOrder: item.sortOrder,
    });
  }

  if (items.length === 0) {
    return defaults;
  }

  const removedSystemIds = new Set(["sys-delivery-kyrgyzstan"]);
  const kept = items.filter((item) => !removedSystemIds.has(item.id));

  const existingIds = new Set(kept.map((item) => item.id));
  for (const item of defaults) {
    if (!existingIds.has(item.id)) {
      kept.push(item);
    }
  }

  return sortExpenseItems(kept);
}

function toDto(
  companyId: string,
  expenseItems: CalculatorExpenseItem[],
  customOrigins: CustomCalculatorOrigin[],
  updatedAt: Date | null,
): CompanyCalculatorSettingsDto {
  return {
    companyId,
    expenseItems,
    customOrigins,
    updatedAt: updatedAt?.toISOString() ?? null,
  };
}

export async function ensureCompanyCalculatorSettings(
  companyId: string,
): Promise<CompanyCalculatorSettingsDto> {
  const existing = await prisma.companyCalculatorSettings.findUnique({
    where: { companyId },
  });

  if (existing) {
    const expenseItems = normalizeItems(existing.expenseItems);
    const customOrigins = normalizeCustomOrigins(existing.customOrigins);
    const previousCount = Array.isArray(existing.expenseItems) ? existing.expenseItems.length : 0;
    if (expenseItems.length !== previousCount) {
      await prisma.companyCalculatorSettings.update({
        where: { companyId },
        data: { expenseItems: expenseItems as unknown as Prisma.InputJsonValue },
      });
    }
    return toDto(companyId, expenseItems, customOrigins, existing.updatedAt);
  }

  const defaults = getDefaultCompanyCalculatorExpenses();
  const created = await prisma.companyCalculatorSettings.create({
    data: {
      companyId,
      expenseItems: defaults as unknown as Prisma.InputJsonValue,
      customOrigins: [] as unknown as Prisma.InputJsonValue,
    },
  });

  return toDto(companyId, defaults, [], created.updatedAt);
}

export async function getCompanyCalculatorSettings(
  companyId: string,
): Promise<CompanyCalculatorSettingsDto> {
  return ensureCompanyCalculatorSettings(companyId);
}

export async function saveCompanyCalculatorExpenses(
  companyId: string,
  expenseItems: CalculatorExpenseItemInput[],
  customOriginsInput?: CustomCalculatorOriginInput[],
): Promise<CompanyCalculatorSettingsDto> {
  await ensureCompanyCalculatorSettings(companyId);
  const existing = await prisma.companyCalculatorSettings.findUniqueOrThrow({
    where: { companyId },
  });

  const customOrigins =
    customOriginsInput !== undefined
      ? normalizeCustomOrigins(customOriginsInput)
      : normalizeCustomOrigins(existing.customOrigins);

  const allowedOrigins = new Set<string>(["all", "china", "korea", "kyrgyzstan"]);
  for (const origin of customOrigins) {
    allowedOrigins.add(origin.id);
  }

  const filteredItems = sortExpenseItems(
    (expenseItems as CalculatorExpenseItem[]).filter((item) => allowedOrigins.has(item.origin)),
  );

  const record = await prisma.companyCalculatorSettings.update({
    where: { companyId },
    data: {
      expenseItems: filteredItems as unknown as Prisma.InputJsonValue,
      customOrigins: customOrigins as unknown as Prisma.InputJsonValue,
    },
  });

  return toDto(companyId, filteredItems, customOrigins, record.updatedAt);
}

export async function addCompanyCustomOrigin(
  companyId: string,
  label: string,
): Promise<CompanyCalculatorSettingsDto> {
  const settings = await ensureCompanyCalculatorSettings(companyId);
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("Укажите название страны");
  }

  const existingIds = new Set(settings.customOrigins.map((item) => item.id));
  const id = ensureUniqueCustomOriginId(createCustomOriginId(trimmed), existingIds);
  const nextOrigins: CustomCalculatorOrigin[] = [
    ...settings.customOrigins,
    { id, label: trimmed.slice(0, 80), calcProfile: "china" },
  ];

  const seedExpense: CalculatorExpenseItem = {
    id: createExpenseItemId(),
    label: `Расходы (${trimmed.slice(0, 40)})`,
    defaultAmount: 5000,
    currency: "CNY",
    origin: id,
    role: "china_local",
    sortOrder: 10,
  };

  return saveCompanyCalculatorExpenses(
    companyId,
    [...settings.expenseItems, seedExpense],
    nextOrigins,
  );
}

export async function removeCompanyCustomOrigin(
  companyId: string,
  originId: string,
): Promise<CompanyCalculatorSettingsDto> {
  const settings = await ensureCompanyCalculatorSettings(companyId);
  if (!settings.customOrigins.some((item) => item.id === originId)) {
    throw new Error("Страна не найдена");
  }

  const nextOrigins = settings.customOrigins.filter((item) => item.id !== originId);
  const nextItems = settings.expenseItems.filter((item) => item.origin !== originId);
  return saveCompanyCalculatorExpenses(companyId, nextItems, nextOrigins);
}
