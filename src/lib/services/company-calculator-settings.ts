import { Prisma } from "@prisma/client";
import {
  CalculatorExpenseItem,
  getDefaultCompanyCalculatorExpenses,
  sortExpenseItems,
} from "@/lib/customs-calculator/expense-template";
import { prisma } from "@/lib/prisma";
import type { CalculatorExpenseItemInput } from "@/lib/validators/company-calculator-settings";

export interface CompanyCalculatorSettingsDto {
  companyId: string;
  expenseItems: CalculatorExpenseItem[];
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

  // Подмешиваем новые системные пункты (например, Киргизия), не трогая уже сохранённые.
  const existingIds = new Set(items.map((item) => item.id));
  for (const item of defaults) {
    if (!existingIds.has(item.id)) {
      items.push(item);
    }
  }

  return sortExpenseItems(items);
}

export async function ensureCompanyCalculatorSettings(
  companyId: string,
): Promise<CompanyCalculatorSettingsDto> {
  const existing = await prisma.companyCalculatorSettings.findUnique({
    where: { companyId },
  });

  if (existing) {
    const expenseItems = normalizeItems(existing.expenseItems);
    const previousCount = Array.isArray(existing.expenseItems) ? existing.expenseItems.length : 0;
    if (expenseItems.length > previousCount) {
      await prisma.companyCalculatorSettings.update({
        where: { companyId },
        data: { expenseItems: expenseItems as unknown as Prisma.InputJsonValue },
      });
    }
    return {
      companyId,
      expenseItems,
      updatedAt: existing.updatedAt.toISOString(),
    };
  }

  const defaults = getDefaultCompanyCalculatorExpenses();
  const created = await prisma.companyCalculatorSettings.create({
    data: {
      companyId,
      expenseItems: defaults as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    companyId,
    expenseItems: defaults,
    updatedAt: created.updatedAt.toISOString(),
  };
}

export async function getCompanyCalculatorSettings(
  companyId: string,
): Promise<CompanyCalculatorSettingsDto> {
  return ensureCompanyCalculatorSettings(companyId);
}

export async function saveCompanyCalculatorExpenses(
  companyId: string,
  expenseItems: CalculatorExpenseItemInput[],
): Promise<CompanyCalculatorSettingsDto> {
  const sorted = sortExpenseItems(expenseItems as CalculatorExpenseItem[]);
  const record = await prisma.companyCalculatorSettings.upsert({
    where: { companyId },
    create: {
      companyId,
      expenseItems: sorted as unknown as Prisma.InputJsonValue,
    },
    update: {
      expenseItems: sorted as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    companyId,
    expenseItems: sorted,
    updatedAt: record.updatedAt.toISOString(),
  };
}
