import { CatalogVehicleStatus, Prisma } from "@prisma/client";
import {
  calculateCustoms,
  type CarAge,
  type CurrencyCode,
  type CustomsCalculatorInput,
  type CustomsCalculatorResult,
  type ExchangeRates,
  findExpenseByRole,
  isChinaLikeOrigin,
  listExtraExpenses,
  roundExchangeRates,
} from "@/lib/customs-calculator";
import { fetchGoogleFinanceRates } from "@/lib/customs-calculator/google-finance-rates";
import { applyDealExchangeRate } from "@/lib/customs-calculator/deal-exchange-rate";
import { AuthUser } from "@/lib/permissions";
import { assertCompanyCatalogAccess } from "@/lib/services/company-workspace";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/audit";
import { getCompanyCalculatorSettings } from "@/lib/services/company-calculator-settings";
import { catalogEstimateSchema } from "@/lib/validators/catalog";
import { customsEstimateInputSchema } from "@/lib/validators/customs-estimate";
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
  await assertCompanyCatalogAccess(user);

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
  await assertCompanyCatalogAccess(user);
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

function carYearFromAge(age: CarAge): number {
  const year = new Date().getFullYear();
  if (age === "new") return year;
  if (age === "under3") return year - 1;
  if (age === "from3to5") return year - 4;
  if (age === "from5to7") return year - 6;
  return year - 8;
}

export async function upsertCatalogVehicleEstimateFromInput(
  user: AuthUser,
  vehicleId: string,
  rawInput: unknown,
) {
  await assertCompanyCatalogAccess(user);
  const input = customsEstimateInputSchema.parse(rawInput) as CustomsCalculatorInput;

  const vehicle = await prisma.catalogVehicle.findFirst({
    where: { id: vehicleId, companyId: user.companyId },
    select: { id: true },
  });
  if (!vehicle) throw new Error("NOT_FOUND");

  const result = calculateCustoms(input);
  if (!result) throw new Error("INVALID_CALCULATION");
  const carYear = carYearFromAge(input.age);

  await prisma.catalogVehicle.update({
    where: { id: vehicleId },
    data: {
      priceCny: new Prisma.Decimal(input.price),
      priceCurrency: input.currency,
      powerHp: Math.round(input.powerHp),
      volumeCc: Math.round(input.volumeCc),
      carYear,
    },
  });

  const saved = await prisma.catalogVehicleCustomsEstimate.upsert({
    where: { catalogVehicleId: vehicleId },
    create: {
      catalogVehicleId: vehicleId,
      createdById: user.id,
      price: new Prisma.Decimal(input.price),
      currency: input.currency,
      powerHp: Math.round(input.powerHp),
      volumeCc: Math.round(input.volumeCc),
      carYear,
      input: input as unknown as Prisma.InputJsonValue,
      result: result as unknown as Prisma.InputJsonValue,
      totalWithCar: new Prisma.Decimal(result.totalWithCar),
    },
    update: {
      createdById: user.id,
      price: new Prisma.Decimal(input.price),
      currency: input.currency,
      powerHp: Math.round(input.powerHp),
      volumeCc: Math.round(input.volumeCc),
      carYear,
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
  await assertCompanyCatalogAccess(user);

  const vehicle = await prisma.catalogVehicle.findFirst({
    where: { id: vehicleId, companyId: user.companyId },
    select: {
      priceCny: true,
      priceCurrency: true,
      powerHp: true,
      volumeCc: true,
      carYear: true,
      customsEstimate: { select: { input: true } },
    },
  });
  if (!vehicle) throw new Error("NOT_FOUND");
  if (vehicle.priceCny == null || vehicle.carYear == null) {
    throw new Error("INSUFFICIENT_DATA");
  }

  const previousInput = vehicle.customsEstimate?.input as { originCountry?: string } | null;
  const destinationCountry =
    typeof previousInput?.originCountry === "string" && previousInput.originCountry
      ? previousInput.originCountry
      : "china";
  const currency = (["CNY", "USD", "KRW", "RUB"] as const).includes(
    vehicle.priceCurrency as "CNY" | "USD" | "KRW" | "RUB",
  )
    ? (vehicle.priceCurrency as "CNY" | "USD" | "KRW" | "RUB")
    : "CNY";

  return upsertCatalogVehicleEstimate(user, vehicleId, {
    destinationCountry,
    price: Number(vehicle.priceCny),
    currency,
    powerHp: vehicle.powerHp ?? 150,
    volumeCc: vehicle.volumeCc ?? 2000,
    carYear: vehicle.carYear,
  });
}

export interface CatalogRatesRecalcResult {
  updated: number;
  skipped: number;
  failed: number;
  rates: ExchangeRates;
  fetchedAt: string;
}

/** Подставляет свежие курсы в сохранённый ввод калькулятора, не дублируя формулы. */
export function applyFreshRatesToCatalogEstimateInput(
  rawInput: unknown,
  rates: ExchangeRates,
): CustomsCalculatorInput {
  const input = customsEstimateInputSchema.parse(rawInput) as CustomsCalculatorInput;
  return {
    ...input,
    rates: roundExchangeRates(rates),
  };
}

export async function recalculateActiveCatalogEstimates(
  user: AuthUser,
): Promise<CatalogRatesRecalcResult> {
  await assertCompanyCatalogAccess(user);

  let fetched: { rates: ExchangeRates; fetchedAt: string };
  try {
    fetched = await fetchGoogleFinanceRates({ force: true });
  } catch {
    throw new Error("RATES_UNAVAILABLE");
  }

  const vehicles = await prisma.catalogVehicle.findMany({
    where: { companyId: user.companyId, status: CatalogVehicleStatus.ACTIVE },
    select: {
      id: true,
      customsEstimate: { select: { id: true, input: true } },
    },
  });

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const vehicle of vehicles) {
    if (!vehicle.customsEstimate) {
      skipped += 1;
      continue;
    }

    try {
      const input = applyFreshRatesToCatalogEstimateInput(
        vehicle.customsEstimate.input,
        fetched.rates,
      );
      const result = calculateCustoms(input);
      if (!result) {
        failed += 1;
        continue;
      }

      await prisma.catalogVehicleCustomsEstimate.update({
        where: { id: vehicle.customsEstimate.id },
        data: {
          input: input as unknown as Prisma.InputJsonValue,
          result: result as unknown as Prisma.InputJsonValue,
          totalWithCar: new Prisma.Decimal(result.totalWithCar),
        },
      });
      updated += 1;
    } catch (err) {
      failed += 1;
      console.error(`Catalog rate recalc failed for vehicle ${vehicle.id}`, err);
    }
  }

  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    entity: "CatalogVehicleCustomsEstimate",
    entityId: user.companyId,
    action: "RECALCULATE_RATES",
    newValue: {
      updated,
      skipped,
      failed,
      rates: {
        USD: fetched.rates.USD,
        EUR: fetched.rates.EUR,
        CNY: fetched.rates.CNY,
        KRW: fetched.rates.KRW,
      },
    },
  });

  return {
    updated,
    skipped,
    failed,
    rates: fetched.rates,
    fetchedAt: fetched.fetchedAt,
  };
}
