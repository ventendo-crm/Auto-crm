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
import { applyDealExchangeRate } from "@/lib/customs-calculator/deal-exchange-rate";
import { AuthUser, canAccessCatalog } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/audit";
import { getCompanyCalculatorSettings } from "@/lib/services/company-calculator-settings";
import { catalogEstimateSchema } from "@/lib/validators/catalog";
import { z } from "zod";

type EstimateInput = z.infer<typeof catalogEstimateSchema>;

export interface CatalogVehicleEstimateItem {
  id: string;
  catalogVehicleId: string;
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
  catalogVehicleId: string;
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
}): CatalogVehicleEstimateItem {
  return {
    id: record.id,
    catalogVehicleId: record.catalogVehicleId,
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

async function buildCalculatorInput(
  companyId: string,
  body: EstimateInput,
): Promise<CustomsCalculatorInput> {
  const settings = await getCompanyCalculatorSettings(companyId);
  const originCountry = body.destinationCountry;
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
  const rates = applyDealExchangeRate(
    (await fetchGoogleFinanceRates()).rates,
    originCountry,
    body.exchangeRate ?? null,
    settings.customOrigins,
  );

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
      isChinaLikeOrigin(originCountry) && chinaLocal
        ? chinaExpensesForAge(age)
        : (chinaLocal?.defaultAmount ?? 0),
    cityDeliveryUsd: cityDelivery?.defaultAmount ?? 0,
    koreaDocsDeliveryKrw: koreaDocs?.defaultAmount ?? 0,
    parkingFeeKrw: koreaParking?.defaultAmount ?? 0,
    brokerFeeRub: broker?.defaultAmount ?? 0,
    deliveryRub: delivery?.defaultAmount ?? 0,
    deliveryUsd: deliveryUsd?.defaultAmount ?? 0,
    escortRub: escort?.defaultAmount ?? 0,
    deliveryRoute: originCountry === "korea" ? "vladivostok" : "ussuriysk",
    extraExpenses,
  };
}

export async function getCatalogVehicleEstimate(user: AuthUser, vehicleId: string) {
  if (!canAccessCatalog(user.role)) throw new Error("Forbidden");

  const record = await prisma.catalogVehicleCustomsEstimate.findFirst({
    where: { catalogVehicleId: vehicleId, catalogVehicle: { companyId: user.companyId } },
    include: { createdBy: { select: { name: true } } },
  });
  return record ? serializeEstimate(record) : null;
}

export async function upsertCatalogVehicleEstimate(
  user: AuthUser,
  vehicleId: string,
  body: EstimateInput,
) {
  if (!canAccessCatalog(user.role)) throw new Error("Forbidden");
  const parsed = catalogEstimateSchema.parse(body);

  const vehicle = await prisma.catalogVehicle.findFirst({
    where: { id: vehicleId, companyId: user.companyId },
    select: { id: true },
  });
  if (!vehicle) throw new Error("NOT_FOUND");

  const input = await buildCalculatorInput(user.companyId, parsed);
  const result = calculateCustoms(input);
  if (!result) throw new Error("INVALID_CALCULATION");

  const saved = await prisma.catalogVehicleCustomsEstimate.upsert({
    where: { catalogVehicleId: vehicleId },
    create: {
      catalogVehicleId: vehicleId,
      createdById: user.id,
      price: new Prisma.Decimal(parsed.price),
      currency: parsed.currency,
      powerHp: parsed.powerHp,
      volumeCc: parsed.volumeCc,
      carYear: parsed.carYear,
      note: parsed.note?.trim() || null,
      input: input as unknown as Prisma.InputJsonValue,
      result: result as unknown as Prisma.InputJsonValue,
      totalWithCar: new Prisma.Decimal(result.totalWithCar),
    },
    update: {
      createdById: user.id,
      price: new Prisma.Decimal(parsed.price),
      currency: parsed.currency,
      powerHp: parsed.powerHp,
      volumeCc: parsed.volumeCc,
      carYear: parsed.carYear,
      note: parsed.note?.trim() || null,
      input: input as unknown as Prisma.InputJsonValue,
      result: result as unknown as Prisma.InputJsonValue,
      totalWithCar: new Prisma.Decimal(result.totalWithCar),
    },
    include: { createdBy: { select: { name: true } } },
  });

  await createAuditLog({
    userId: user.id,
    entity: "CatalogVehicleCustomsEstimate",
    entityId: saved.id,
    action: "UPSERT",
    newValue: {
      catalogVehicleId: vehicleId,
      totalWithCar: Number(saved.totalWithCar),
    },
  });

  return serializeEstimate(saved);
}

export async function autoEstimateCatalogVehicle(user: AuthUser, vehicleId: string) {
  if (!canAccessCatalog(user.role)) throw new Error("Forbidden");

  const vehicle = await prisma.catalogVehicle.findFirst({
    where: { id: vehicleId, companyId: user.companyId },
    select: {
      priceCny: true,
      powerHp: true,
      volumeCc: true,
      carYear: true,
    },
  });
  if (!vehicle) throw new Error("NOT_FOUND");
  if (vehicle.priceCny == null || vehicle.carYear == null) {
    throw new Error("INSUFFICIENT_DATA");
  }

  return upsertCatalogVehicleEstimate(user, vehicleId, {
    destinationCountry: "china",
    price: Number(vehicle.priceCny),
    currency: "CNY",
    powerHp: vehicle.powerHp ?? 150,
    volumeCc: vehicle.volumeCc ?? 2000,
    carYear: vehicle.carYear,
  });
}
