import { AuthUser } from "@/lib/permissions";
import { assertCompanyCatalogAccess } from "@/lib/services/company-workspace";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/audit";
import {
  createCatalogSectionSchema,
  updateCatalogSectionSchema,
} from "@/lib/validators/catalog";
import { z } from "zod";

type CreateInput = z.infer<typeof createCatalogSectionSchema>;
type UpdateInput = z.infer<typeof updateCatalogSectionSchema>;

function serializeSection(record: {
  id: string;
  title: string;
  sortOrder: number;
  _count: { vehicles: number };
}) {
  return {
    id: record.id,
    title: record.title,
    sortOrder: record.sortOrder,
    vehicleCount: record._count.vehicles,
  };
}

export async function listCatalogSections(user: AuthUser) {
  await assertCompanyCatalogAccess(user);
  const rows = await prisma.catalogSection.findMany({
    where: { companyId: user.companyId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { vehicles: true } } },
  });
  return rows.map(serializeSection);
}

export async function createCatalogSection(user: AuthUser, body: CreateInput) {
  await assertCompanyCatalogAccess(user);
  const data = createCatalogSectionSchema.parse(body);

  const last = await prisma.catalogSection.findFirst({
    where: { companyId: user.companyId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const record = await prisma.catalogSection.create({
    data: {
      companyId: user.companyId,
      createdById: user.id,
      title: data.title,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
    include: { _count: { select: { vehicles: true } } },
  });

  await createAuditLog({
    userId: user.id,
    entity: "CatalogSection",
    entityId: record.id,
    action: "CREATE",
    newValue: { title: record.title },
  });

  return serializeSection(record);
}

export async function updateCatalogSection(user: AuthUser, id: string, body: UpdateInput) {
  await assertCompanyCatalogAccess(user);
  const data = updateCatalogSectionSchema.parse(body);

  const existing = await prisma.catalogSection.findFirst({
    where: { id, companyId: user.companyId },
    select: { id: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  const record = await prisma.catalogSection.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
    },
    include: { _count: { select: { vehicles: true } } },
  });

  return serializeSection(record);
}

export async function deleteCatalogSection(user: AuthUser, id: string) {
  await assertCompanyCatalogAccess(user);
  const existing = await prisma.catalogSection.findFirst({
    where: { id, companyId: user.companyId },
    select: { id: true, title: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  await prisma.$transaction([
    prisma.catalogVehicle.updateMany({
      where: { sectionId: id, companyId: user.companyId },
      data: { sectionId: null },
    }),
    prisma.catalogSection.delete({ where: { id } }),
  ]);

  await createAuditLog({
    userId: user.id,
    entity: "CatalogSection",
    entityId: id,
    action: "DELETE",
    oldValue: { title: existing.title },
  });
}

export async function assertSectionInCompany(companyId: string, sectionId: string | null | undefined) {
  if (!sectionId) return null;
  const section = await prisma.catalogSection.findFirst({
    where: { id: sectionId, companyId },
    select: { id: true },
  });
  if (!section) throw new Error("NOT_FOUND");
  return section.id;
}
