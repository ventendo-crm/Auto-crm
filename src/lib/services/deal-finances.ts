import { DealExpenseItem, sumDealExpenses } from "@/lib/services/deal-expenses";
import { DealFinancialSummary } from "@/lib/types";

function toNumber(value: number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number.isFinite(value) ? value : 0;
}

export function buildDealFinancialSummary(
  deal: {
    prepayment?: number | null;
    balance?: number | null;
    purchasePrice?: number | null;
  },
  expenses: DealExpenseItem[],
): DealFinancialSummary {
  const prepayment = toNumber(deal.prepayment);
  const balance = toNumber(deal.balance);
  const purchasePrice = toNumber(deal.purchasePrice);
  const expensesTotal = sumDealExpenses(expenses);
  const clientTotal = prepayment + balance;
  const costsTotal = purchasePrice + expensesTotal;

  return {
    prepayment,
    balance,
    clientTotal,
    purchasePrice,
    expensesTotal,
    costsTotal,
    estimatedMargin: clientTotal - costsTotal,
  };
}
