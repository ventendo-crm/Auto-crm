import { Prisma } from "@prisma/client";
import {
  calculateCustoms,
  type CarAge,
  type CurrencyCode,
  type CustomsCalculatorInput,
  type CustomsCalculatorResult,
  findExpenseByRole,
  isChinaLikeOrigin,
  listExtraExpenses,
} from "@/lib/customs-calculator";
import { fetchGoogleFinanceRates } from "@/lib/customs-calculator/google-finance-rates";
import { AuthUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/audit";
import { getCompanyCalculatorSettings } from "@/lib/services/company-calculator-settings";
import { upsertVariantCustomsEstimateSchema } from "@/lib/validators/variant-customs-estimate";
import { z } from "zod";

type UpsertInput = z.infer<typeof upsertVariantCustomsEstimateSchema>;

export interface SearchProcessEntryEstimateItem {
  id: string;
  searchProcessEntryId: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  price: number;
  currency: CurrencyCode;
  powerHp: number;
  volumeCc: number;
  carYear: number;
  note: string | null;
  input: CustomsCalculatorInput;
  result: CustomsCalculatorResult;
  totalWithCar: number;
}

function resolveCarAge(carYear: number): CarAge {
  const currentYear = new Date().getFullYear();
  const diff = Math.max(0, currentYear - carYear);
  if (diff === 0) return "new";
  if (diff < 3) return "under3";
  if (diff <= 5) return "from3to5";
  if (diff <= 7) return "from5to7";
  return "over7";
}

function chinaExpensesForAge(age: CarAge): number {
  return age === "new" ? 5000 : 12000;
}

function serializeEstimate(record: {
  id: string;
  searchProcessEntryId: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  price: Prisma.Decimal;
  currency: string;
  powerHp: number;
  volumeCc: number;
  carYear: number;
  note: string | null;
  input: Prisma.JsonValue;
  result: Prisma.JsonValue;
  totalWithCar: Prisma.Decimal;
  createdBy: { name: string };
}): SearchProcessEntryEstimateItem {
  return {
    id: record.id,
    searchProcessEntryId: record.searchProcessEntryId,
    createdById: record.createdById,
    createdByName: record.createdBy.name,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    price: Number(record.price),
    currency: record.currency as CurrencyCode,
    powerHp: record.powerHp,
    volumeCc: record.volumeCc,
    carYear: record.carYear,
    note: record.note,
    input: record.input as unknown as CustomsCalculatorInput,
    result: record.result as unknown as CustomsCalculatorResult,
    totalWithCar: Number(record.totalWithCar),
  };
}

async function buildCalculatorInput(entryId: string, body: UpsertInput): Promise<CustomsCalculatorInput> {
  const entry = await prisma.searchProcessEntry.findUnique({
    where: { id: entryId },
    select: { id: true, deal: { select: { companyId: true, destinationCountry: true } } },
  });
  if (!entry) {
    throw new Error("NOT_FOUND");
  }

  const settings = await getCompanyCalculatorSettings(entry.deal.companyId);
  const originCountry = entry.deal.destinationCountry;
  const age = resolveCarAge(body.carYear);
  const expenseItems = settings.expenseItems;
  const broker = findExpenseByRole(expenseItems, "broker", originCountry);
  const delivery = findExpenseByRole(expenseItems, "delivery", originCountry);
  const deliveryUsd = findExpenseByRole(expenseItems, "delivery_usd", originCountry);
  const escort = findExpenseByRole(expenseItems, "escort", originCountry);
  const chinaLocal = findExpenseByRole(expenseItems, "china_local", originCountry);
  const cityDelivery = findExpenseByRole(expenseItems, "city_delivery", originCountry);
  const koreaDocs = findExpenseByRole(expenseItems, "korea_docs", originCountry);
  const koreaParking = findExpenseByRole(expenseItems, "korea_parking", originCountry);
  const extraExpenses = listExtraExpenses(expenseItems, originCountry).map((item) => ({
    id: item.id,
    label: item.label,
    amount: item.defaultAmount,
    currency: item.currency,
  }));
  const rates = (await fetchGoogleFinanceRates()).rates;

  return {
    originCountry,
    importer: "personal",
    age,
    engine: "petrol",
    powerHp: body.powerHp,
    volumeCc: body.volumeCc,
    price: body.price,
    currency: body.currency,
    rates,
    chinaExpensesCny:
      body.chinaExpensesCny ??
      (isChinaLikeOrigin(originCountry) && chinaLocal
        ? chinaExpensesForAge(age)
        : (chinaLocal?.defaultAmount ?? 0)),
    cityDeliveryUsd: body.cityDeliveryUsd ?? cityDelivery?.defaultAmount ?? 0,
    koreaDocsDeliveryKrw: body.koreaDocsDeliveryKrw ?? koreaDocs?.defaultAmount ?? 0,
    parkingFeeKrw: body.parkingFeeKrw ?? koreaParking?.defaultAmount ?? 0,
    brokerFeeRub: body.brokerFeeRub ?? broker?.defaultAmount ?? 0,
    deliveryRub: body.deliveryRub ?? delivery?.defaultAmount ?? 0,
    deliveryUsd: body.deliveryUsd ?? deliveryUsd?.defaultAmount ?? 0,
    escortRub: body.escortRub ?? escort?.defaultAmount ?? 0,
    deliveryRoute: body.deliveryRoute ?? (originCountry === "korea" ? "vladivostok" : "ussuriysk"),
    extraExpenses,
  };
}

export async function getSearchProcessEntryEstimate(
  dealId: string,
  entryId: string,
): Promise<SearchProcessEntryEstimateItem | null> {
  const record = await prisma.searchProcessEntryCustomsEstimate.findFirst({
    where: { searchProcessEntryId: entryId, searchProcessEntry: { dealId } },
    include: { createdBy: { select: { name: true } } },
  });
  return record ? serializeEstimate(record) : null;
}

export async function upsertSearchProcessEntryEstimate(
  user: AuthUser,
  dealId: string,
  entryId: string,
  body: UpsertInput,
): Promise<SearchProcessEntryEstimateItem> {
  const existingEntry = await prisma.searchProcessEntry.findFirst({
    where: { id: entryId, dealId },
    select: { id: true },
  });
  if (!existingEntry) {
    throw new Error("NOT_FOUND");
  }

  const input = await buildCalculatorInput(entryId, body);
  const result = calculateCustoms(input);
  if (!result) {
    throw new Error("INVALID_CALCULATION");
  }

  const saved = await prisma.searchProcessEntryCustomsEstimate.upsert({
    where: { searchProcessEntryId: entryId },
    create: {
      searchProcessEntryId: entryId,
      createdById: user.id,
      price: new Prisma.Decimal(body.price),
      currency: body.currency,
      powerHp: body.powerHp,
      volumeCc: body.volumeCc,
      carYear: body.carYear,
      note: body.note?.trim() || null,
      input: input as unknown as Prisma.InputJsonValue,
      result: result as unknown as Prisma.InputJsonValue,
      totalWithCar: new Prisma.Decimal(result.totalWithCar),
    },
    update: {
      createdById: user.id,
      price: new Prisma.Decimal(body.price),
      currency: body.currency,
      powerHp: body.powerHp,
      volumeCc: body.volumeCc,
      carYear: body.carYear,
      note: body.note?.trim() || null,
      input: input as unknown as Prisma.InputJsonValue,
      result: result as unknown as Prisma.InputJsonValue,
      totalWithCar: new Prisma.Decimal(result.totalWithCar),
    },
    include: { createdBy: { select: { name: true } } },
  });

  await createAuditLog({
    userId: user.id,
    entity: "SearchProcessEntryCustomsEstimate",
    entityId: saved.id,
    action: "UPSERT",
    newValue: {
      dealId,
      searchProcessEntryId: entryId,
      totalWithCar: Number(saved.totalWithCar),
      price: Number(saved.price),
      currency: saved.currency,
      powerHp: saved.powerHp,
      volumeCc: saved.volumeCc,
      carYear: saved.carYear,
    },
  });

  return serializeEstimate(saved);
}

export async function deleteSearchProcessEntryEstimate(
  user: AuthUser,
  dealId: string,
  entryId: string,
): Promise<void> {
  const existing = await prisma.searchProcessEntryCustomsEstimate.findFirst({
    where: { searchProcessEntryId: entryId, searchProcessEntry: { dealId } },
    select: { id: true, totalWithCar: true },
  });
  if (!existing) {
    throw new Error("NOT_FOUND");
  }

  await prisma.searchProcessEntryCustomsEstimate.delete({ where: { id: existing.id } });
  await createAuditLog({
    userId: user.id,
    entity: "SearchProcessEntryCustomsEstimate",
    entityId: existing.id,
    action: "DELETE",
    oldValue: {
      dealId,
      searchProcessEntryId: entryId,
      totalWithCar: Number(existing.totalWithCar),
    },
  });
}
