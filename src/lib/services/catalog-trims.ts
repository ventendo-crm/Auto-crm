import { Prisma } from "@prisma/client";
import { DEFAULT_CATALOG_TRIM_TITLE, MAX_CATALOG_VEHICLE_TRIMS } from "@/lib/constants";
import { AuthUser } from "@/lib/permissions";
import { assertCompanyCatalogAccess } from "@/lib/services/company-workspace";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/audit";
import { createCatalogTrimSchema, updateCatalogTrimSchema } from "@/lib/validators/catalog";
import { z } from "zod";

type CreateInput = z.infer<typeof createCatalogTrimSchema>;
type UpdateInput = z.infer<typeof updateCatalogTrimSchema>;

export async function assertVehicleTrimAccess(
  user: AuthUser,
  vehicleId: string,
  trimId?: string | null,
) {
  await assertCompanyCatalogAccess(user);
  const vehicle = await prisma.catalogVehicle.findFirst({
    where: { id: vehicleId, companyId: user.companyId },
    include: {
      trims: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!vehicle) throw new Error("NOT_FOUND");

  if (!trimId) {
    const first = vehicle.trims[0];
    if (!first) throw new Error("NOT_FOUND");
    return { vehicle, trim: first };
  }

  const trim = vehicle.trims.find((item) => item.id === trimId);
  if (!trim) throw new Error("NOT_FOUND");
  return { vehicle, trim };
}

export async function createCatalogVehicleTrim(
  user: AuthUser,
  vehicleId: string,
  body: CreateInput,
) {
  const parsed = createCatalogTrimSchema.parse(body);
  const { vehicle } = await assertVehicleTrimAccess(user, vehicleId);

  if (vehicle.trims.length >= MAX_CATALOG_VEHICLE_TRIMS) {
    throw new Error("TRIM_LIMIT");
  }

  const source =
    parsed.copyFromTrimId != null
      ? vehicle.trims.find((item) => item.id === parsed.copyFromTrimId)
      : vehicle.trims[vehicle.trims.length - 1];
  if (parsed.copyFromTrimId && !source) throw new Error("NOT_FOUND");

  const sourceEstimate = source
    ? await prisma.catalogVehicleCustomsEstimate.findUnique({
        where: { catalogVehicleTrimId: source.id },
      })
    : null;

  const maxSort = vehicle.trims.reduce((max, item) => Math.max(max, item.sortOrder), -1);

  const trim = await prisma.$transaction(async (tx) => {
    const created = await tx.catalogVehicleTrim.create({
      data: {
        catalogVehicleId: vehicleId,
        title: parsed.title,
        sortOrder: maxSort + 1,
      },
    });

    if (sourceEstimate) {
      await tx.catalogVehicleCustomsEstimate.create({
        data: {
          catalogVehicleTrimId: created.id,
          createdById: user.id,
          price: sourceEstimate.price,
          currency: sourceEstimate.currency,
          powerHp: sourceEstimate.powerHp,
          volumeCc: sourceEstimate.volumeCc,
          carYear: sourceEstimate.carYear,
          input: sourceEstimate.input as Prisma.InputJsonValue,
          result: sourceEstimate.result as Prisma.InputJsonValue,
          totalWithCar: sourceEstimate.totalWithCar,
          note: sourceEstimate.note,
        },
      });
    }

    return created;
  });

  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    entity: "CatalogVehicleTrim",
    entityId: trim.id,
    action: "CREATE",
    newValue: { catalogVehicleId: vehicleId, title: trim.title, copiedFrom: source?.id ?? null },
  });

  return trim;
}

export async function updateCatalogVehicleTrim(
  user: AuthUser,
  vehicleId: string,
  trimId: string,
  body: UpdateInput,
) {
  const parsed = updateCatalogTrimSchema.parse(body);
  await assertVehicleTrimAccess(user, vehicleId, trimId);

  const trim = await prisma.catalogVehicleTrim.update({
    where: { id: trimId },
    data: { title: parsed.title },
  });

  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    entity: "CatalogVehicleTrim",
    entityId: trim.id,
    action: "UPDATE",
    newValue: { title: trim.title },
  });

  return trim;
}

export async function deleteCatalogVehicleTrim(user: AuthUser, vehicleId: string, trimId: string) {
  const { vehicle } = await assertVehicleTrimAccess(user, vehicleId, trimId);
  if (vehicle.trims.length <= 1) throw new Error("LAST_TRIM");

  await prisma.catalogVehicleTrim.delete({ where: { id: trimId } });

  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    entity: "CatalogVehicleTrim",
    entityId: trimId,
    action: "DELETE",
    newValue: { catalogVehicleId: vehicleId },
  });
}

export { DEFAULT_CATALOG_TRIM_TITLE };
