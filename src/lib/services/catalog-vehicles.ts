import { CatalogVehicleSource, CatalogVehicleStatus, Prisma } from "@prisma/client";
import { fetchChinaPage } from "@/lib/http/china-fetch";
import {
  normalizeChe168Url,
  parseChe168Html,
  type Che168ParsedListing,
} from "@/lib/catalog/che168-parser";
import { translateCatalogFields } from "@/lib/catalog/translate";
import { AuthUser } from "@/lib/permissions";
import { assertCompanyCatalogAccess } from "@/lib/services/company-workspace";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/audit";
import { serializeGalleryUrls } from "@/lib/services/catalog-serialize";
import {
  catalogVehicleFiltersSchema,
  createCatalogVehicleSchema,
  importChe168Schema,
  updateCatalogVehicleSchema,
} from "@/lib/validators/catalog";
import { z } from "zod";

type FiltersInput = z.infer<typeof catalogVehicleFiltersSchema>;
type CreateInput = z.infer<typeof createCatalogVehicleSchema>;
type UpdateInput = z.infer<typeof updateCatalogVehicleSchema>;
type ImportInput = z.infer<typeof importChe168Schema>;

const vehicleInclude = {
  createdBy: { select: { id: true, name: true } },
  customsEstimate: {
    include: { createdBy: { select: { name: true } } },
  },
} as const;

async function assertCatalogAccess(user: AuthUser) {
  await assertCompanyCatalogAccess(user);
}

function serializeVehicle(record: {
  id: string;
  companyId: string;
  source: CatalogVehicleSource;
  sourceUrl: string | null;
  externalId: string | null;
  titleZh: string;
  titleRu: string;
  descriptionZh: string;
  descriptionRu: string;
  brand: string | null;
  model: string | null;
  carYear: number | null;
  mileageKm: number | null;
  priceCny: Prisma.Decimal | null;
  volumeCc: number | null;
  powerHp: number | null;
  fuelType: string | null;
  transmission: string | null;
  color: string | null;
  location: string | null;
  vin: string | null;
  coverImageUrl: string | null;
  galleryUrls: Prisma.JsonValue;
  videoUrl: string | null;
  status: CatalogVehicleStatus;
  importedAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; name: string };
    customsEstimate?: {
      id: string;
      totalWithCar: Prisma.Decimal;
      currency: string;
      price: Prisma.Decimal;
      carYear: number;
      powerHp: number;
      volumeCc: number;
      input: Prisma.JsonValue;
      result: Prisma.JsonValue;
      createdBy: { name: string };
    } | null;
}) {
  return {
    id: record.id,
    companyId: record.companyId,
    source: record.source,
    sourceUrl: record.sourceUrl,
    externalId: record.externalId,
    titleZh: record.titleZh,
    titleRu: record.titleRu,
    descriptionZh: record.descriptionZh,
    descriptionRu: record.descriptionRu,
    brand: record.brand,
    model: record.model,
    carYear: record.carYear,
    mileageKm: record.mileageKm,
    priceCny: record.priceCny != null ? Number(record.priceCny) : null,
    volumeCc: record.volumeCc,
    powerHp: record.powerHp,
    fuelType: record.fuelType,
    transmission: record.transmission,
    color: record.color,
    location: record.location,
    vin: record.vin,
    coverImageUrl: record.coverImageUrl,
    galleryUrls: serializeGalleryUrls(record.galleryUrls),
    videoUrl: record.videoUrl,
    status: record.status,
    importedAt: record.importedAt?.toISOString() ?? null,
    createdById: record.createdById,
    createdByName: record.createdBy.name,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    estimate: record.customsEstimate
      ? {
          id: record.customsEstimate.id,
          totalWithCar: Number(record.customsEstimate.totalWithCar),
          currency: record.customsEstimate.currency,
          price: Number(record.customsEstimate.price),
          carYear: record.customsEstimate.carYear,
          powerHp: record.customsEstimate.powerHp,
          volumeCc: record.customsEstimate.volumeCc,
          input: record.customsEstimate.input,
          result: record.customsEstimate.result,
          createdByName: record.customsEstimate.createdBy.name,
        }
      : null,
  };
}

function buildWhere(companyId: string, filters: FiltersInput): Prisma.CatalogVehicleWhereInput {
  const where: Prisma.CatalogVehicleWhereInput = { companyId };

  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status;
  } else if (!filters.status) {
    where.status = CatalogVehicleStatus.ACTIVE;
  }

  if (filters.source && filters.source !== "ALL") {
    where.source = filters.source;
  }

  if (filters.brand) {
    where.brand = { contains: filters.brand, mode: "insensitive" };
  }

  if (filters.yearFrom || filters.yearTo) {
    where.carYear = {};
    if (filters.yearFrom) where.carYear.gte = filters.yearFrom;
    if (filters.yearTo) where.carYear.lte = filters.yearTo;
  }

  if (filters.priceFrom || filters.priceTo) {
    where.priceCny = {};
    if (filters.priceFrom != null) where.priceCny.gte = filters.priceFrom;
    if (filters.priceTo != null) where.priceCny.lte = filters.priceTo;
  }

  if (filters.mileageTo != null) {
    where.mileageKm = { lte: filters.mileageTo };
  }

  if (filters.q) {
    where.OR = [
      { titleRu: { contains: filters.q, mode: "insensitive" } },
      { titleZh: { contains: filters.q, mode: "insensitive" } },
      { brand: { contains: filters.q, mode: "insensitive" } },
      { model: { contains: filters.q, mode: "insensitive" } },
      { vin: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function listCatalogVehicles(user: AuthUser, rawFilters: FiltersInput) {
  await assertCatalogAccess(user);
  const filters = catalogVehicleFiltersSchema.parse(rawFilters);
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 24;
  const where = buildWhere(user.companyId, filters);

  const [items, total] = await Promise.all([
    prisma.catalogVehicle.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: vehicleInclude,
    }),
    prisma.catalogVehicle.count({ where }),
  ]);

  return {
    items: items.map(serializeVehicle),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getCatalogVehicle(user: AuthUser, id: string) {
  await assertCatalogAccess(user);
  const record = await prisma.catalogVehicle.findFirst({
    where: { id, companyId: user.companyId },
    include: vehicleInclude,
  });
  if (!record) throw new Error("NOT_FOUND");
  return serializeVehicle(record);
}

export async function createCatalogVehicle(user: AuthUser, body: CreateInput) {
  await assertCatalogAccess(user);
  const data = createCatalogVehicleSchema.parse(body);

  const record = await prisma.catalogVehicle.create({
    data: {
      companyId: user.companyId,
      createdById: user.id,
      source: CatalogVehicleSource.MANUAL,
      titleRu: data.titleRu,
      titleZh: data.titleZh ?? "",
      descriptionRu: data.descriptionRu ?? "",
      descriptionZh: data.descriptionZh ?? "",
      brand: data.brand || null,
      model: data.model || null,
      carYear: data.carYear ?? null,
      mileageKm: data.mileageKm ?? null,
      priceCny: data.priceCny != null ? new Prisma.Decimal(data.priceCny) : null,
      volumeCc: data.volumeCc ?? null,
      powerHp: data.powerHp ?? null,
      fuelType: data.fuelType || null,
      transmission: data.transmission || null,
      color: data.color || null,
      location: data.location || null,
      vin: data.vin || null,
      coverImageUrl: data.coverImageUrl || null,
      galleryUrls: data.galleryUrls ?? [],
      videoUrl: data.videoUrl || null,
    },
    include: vehicleInclude,
  });

  await createAuditLog({
    userId: user.id,
    entity: "CatalogVehicle",
    entityId: record.id,
    action: "CREATE",
    newValue: { titleRu: record.titleRu, source: record.source },
  });

  return serializeVehicle(record);
}

export async function updateCatalogVehicle(user: AuthUser, id: string, body: UpdateInput) {
  await assertCatalogAccess(user);
  const data = updateCatalogVehicleSchema.parse(body);

  const existing = await prisma.catalogVehicle.findFirst({
    where: { id, companyId: user.companyId },
    select: { id: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  const record = await prisma.catalogVehicle.update({
    where: { id },
    data: {
      ...(data.titleRu !== undefined ? { titleRu: data.titleRu } : {}),
      ...(data.titleZh !== undefined ? { titleZh: data.titleZh } : {}),
      ...(data.descriptionRu !== undefined ? { descriptionRu: data.descriptionRu } : {}),
      ...(data.descriptionZh !== undefined ? { descriptionZh: data.descriptionZh } : {}),
      ...(data.brand !== undefined ? { brand: data.brand || null } : {}),
      ...(data.model !== undefined ? { model: data.model || null } : {}),
      ...(data.carYear !== undefined ? { carYear: data.carYear ?? null } : {}),
      ...(data.mileageKm !== undefined ? { mileageKm: data.mileageKm ?? null } : {}),
      ...(data.priceCny !== undefined
        ? { priceCny: data.priceCny != null ? new Prisma.Decimal(data.priceCny) : null }
        : {}),
      ...(data.volumeCc !== undefined ? { volumeCc: data.volumeCc ?? null } : {}),
      ...(data.powerHp !== undefined ? { powerHp: data.powerHp ?? null } : {}),
      ...(data.fuelType !== undefined ? { fuelType: data.fuelType || null } : {}),
      ...(data.transmission !== undefined ? { transmission: data.transmission || null } : {}),
      ...(data.color !== undefined ? { color: data.color || null } : {}),
      ...(data.location !== undefined ? { location: data.location || null } : {}),
      ...(data.vin !== undefined ? { vin: data.vin || null } : {}),
      ...(data.coverImageUrl !== undefined ? { coverImageUrl: data.coverImageUrl || null } : {}),
      ...(data.galleryUrls !== undefined ? { galleryUrls: data.galleryUrls } : {}),
      ...(data.videoUrl !== undefined ? { videoUrl: data.videoUrl || null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
    include: vehicleInclude,
  });

  return serializeVehicle(record);
}

export async function archiveCatalogVehicle(user: AuthUser, id: string) {
  return updateCatalogVehicle(user, id, { status: "ARCHIVED" });
}

async function upsertFromChe168Parsed(
  user: AuthUser,
  parsed: Che168ParsedListing,
  translations: { titleRu: string; descriptionRu: string },
) {
  const existing = await prisma.catalogVehicle.findFirst({
    where: {
      companyId: user.companyId,
      source: CatalogVehicleSource.CHE168,
      externalId: parsed.externalId,
    },
    include: vehicleInclude,
  });

  const payload = {
    sourceUrl: parsed.sourceUrl,
    titleZh: parsed.titleZh,
    titleRu: translations.titleRu || parsed.titleZh,
    descriptionZh: parsed.descriptionZh,
    descriptionRu: translations.descriptionRu || parsed.descriptionZh,
    brand: parsed.brand,
    model: parsed.model,
    carYear: parsed.carYear,
    mileageKm: parsed.mileageKm,
    priceCny: parsed.priceCny != null ? new Prisma.Decimal(parsed.priceCny) : null,
    volumeCc: parsed.volumeCc,
    powerHp: parsed.powerHp,
    fuelType: parsed.fuelType,
    transmission: parsed.transmission,
    color: parsed.color,
    location: parsed.location,
    coverImageUrl: parsed.coverImageUrl,
    galleryUrls: parsed.galleryUrls,
    videoUrl: parsed.videoUrl,
    rawPayload: parsed.rawPayload as Prisma.InputJsonValue,
    importedAt: new Date(),
    status: CatalogVehicleStatus.ACTIVE,
  };

  if (existing) {
    const updated = await prisma.catalogVehicle.update({
      where: { id: existing.id },
      data: payload,
      include: vehicleInclude,
    });
    return { vehicle: serializeVehicle(updated), created: false };
  }

  const created = await prisma.catalogVehicle.create({
    data: {
      companyId: user.companyId,
      createdById: user.id,
      source: CatalogVehicleSource.CHE168,
      externalId: parsed.externalId,
      ...payload,
    },
    include: vehicleInclude,
  });

  await createAuditLog({
    userId: user.id,
    entity: "CatalogVehicle",
    entityId: created.id,
    action: "IMPORT",
    newValue: { source: "CHE168", externalId: parsed.externalId, sourceUrl: parsed.sourceUrl },
  });

  return { vehicle: serializeVehicle(created), created: true };
}

export async function importCatalogVehicleFromChe168(user: AuthUser, body: ImportInput) {
  await assertCatalogAccess(user);
  const input = importChe168Schema.parse(body);
  const sourceUrl = normalizeChe168Url(input.url);
  const { html } = await fetchChinaPage(sourceUrl);
  const parsed = parseChe168Html(html, sourceUrl);

  const shouldTranslate = input.translate !== false;
  const translations = shouldTranslate
    ? await translateCatalogFields({
        titleZh: parsed.titleZh,
        descriptionZh: parsed.descriptionZh,
      })
    : { titleRu: parsed.titleZh, descriptionRu: parsed.descriptionZh };

  return upsertFromChe168Parsed(user, parsed, translations);
}

export async function listCatalogBrands(user: AuthUser) {
  await assertCatalogAccess(user);
  const rows = await prisma.catalogVehicle.findMany({
    where: { companyId: user.companyId, status: CatalogVehicleStatus.ACTIVE, brand: { not: null } },
    distinct: ["brand"],
    select: { brand: true },
    orderBy: { brand: "asc" },
  });
  return rows.map((row) => row.brand).filter((brand): brand is string => Boolean(brand));
}
