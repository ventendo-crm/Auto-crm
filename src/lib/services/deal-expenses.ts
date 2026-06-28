import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthUser } from "@/lib/permissions";
import { replaceDealExpensesSchema } from "@/lib/validators/deal-expenses";
import { z } from "zod";

export interface DealExpenseItem {
  id: string;
  description: string;
  amount: number;
  sortOrder: number;
}

type ReplaceInput = z.infer<typeof replaceDealExpensesSchema>;

function serializeExpense(record: {
  id: string;
  description: string;
  amount: Prisma.Decimal;
  sortOrder: number;
}): DealExpenseItem {
  return {
    id: record.id,
    description: record.description,
    amount: Number(record.amount),
    sortOrder: record.sortOrder,
  };
}

export async function listDealExpenses(dealId: string): Promise<DealExpenseItem[]> {
  const records = await prisma.dealExpense.findMany({
    where: { dealId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return records.map(serializeExpense);
}

export async function replaceDealExpenses(
  _user: AuthUser,
  dealId: string,
  _managerId: string | null,
  input: ReplaceInput,
): Promise<DealExpenseItem[]> {
  const expenses = input.expenses.filter(
    (item) => item.description.trim().length > 0 || item.amount > 0,
  );

  const created = await prisma.$transaction(async (tx) => {
    await tx.dealExpense.deleteMany({ where: { dealId } });

    if (expenses.length === 0) {
      return [];
    }

    await tx.dealExpense.createMany({
      data: expenses.map((item, index) => ({
        dealId,
        description: item.description.trim(),
        amount: new Prisma.Decimal(item.amount),
        sortOrder: index,
      })),
    });

    return tx.dealExpense.findMany({
      where: { dealId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  });

  return created.map(serializeExpense);
}

export function sumDealExpenses(expenses: DealExpenseItem[]): number {
  return expenses.reduce((total, item) => total + item.amount, 0);
}
