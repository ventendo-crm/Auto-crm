import { prisma } from "@/lib/prisma";
import { AuthUser } from "@/lib/permissions";
import { createAuditLog } from "@/lib/services/audit";
import {
  assertDealMediaAccess,
  deleteMedia,
  enrichMediaRecord,
  SEARCH_PROCESS_MEDIA_INCLUDE,
  uploadDealMedia,
} from "@/lib/services/media";

const entryInclude = {
  media: {
    orderBy: { uploadedAt: "asc" as const },
    include: SEARCH_PROCESS_MEDIA_INCLUDE,
  },
} as const;

async function serializeEntry(entry: {
  id: string;
  dealId: string;
  description: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  media: Parameters<typeof enrichMediaRecord>[0][];
}) {
  return {
    id: entry.id,
    dealId: entry.dealId,
    description: entry.description,
    sortOrder: entry.sortOrder,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    media: await Promise.all(entry.media.map(enrichMediaRecord)),
  };
}

export async function listImportProcessEntries(user: AuthUser, dealId: string) {
  await assertDealMediaAccess(user, dealId);

  const entries = await prisma.importProcessEntry.findMany({
    where: { dealId },
    orderBy: { sortOrder: "asc" },
    include: entryInclude,
  });

  return Promise.all(entries.map(serializeEntry));
}

export async function createImportProcessEntry(user: AuthUser, dealId: string) {
  await assertDealMediaAccess(user, dealId, true);

  const last = await prisma.importProcessEntry.findFirst({
    where: { dealId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const entry = await prisma.importProcessEntry.create({
    data: {
      dealId,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
    include: entryInclude,
  });

  await createAuditLog({
    userId: user.id,
    entity: "ImportProcessEntry",
    entityId: entry.id,
    action: "CREATE",
    newValue: {
      dealId,
      sortOrder: entry.sortOrder,
      stageNumber: entry.sortOrder + 1,
    },
  });

  return serializeEntry(entry);
}

export async function updateImportProcessEntry(
  user: AuthUser,
  dealId: string,
  entryId: string,
  description: string,
) {
  await assertDealMediaAccess(user, dealId, true);

  const existing = await prisma.importProcessEntry.findFirst({
    where: { id: entryId, dealId },
  });

  if (!existing) {
    throw new Error("Not found");
  }

  const entry = await prisma.importProcessEntry.update({
    where: { id: entryId },
    data: { description },
    include: entryInclude,
  });

  await createAuditLog({
    userId: user.id,
    entity: "ImportProcessEntry",
    entityId: entryId,
    action: "UPDATE",
    newValue: {
      dealId,
      sortOrder: entry.sortOrder,
      stageNumber: entry.sortOrder + 1,
      description,
    },
  });

  return serializeEntry(entry);
}

export async function deleteImportProcessEntry(
  user: AuthUser,
  dealId: string,
  entryId: string,
) {
  await assertDealMediaAccess(user, dealId, true);

  const entry = await prisma.importProcessEntry.findFirst({
    where: { id: entryId, dealId },
    include: { media: true },
  });

  if (!entry) {
    throw new Error("Not found");
  }

  for (const item of entry.media) {
    await deleteMedia(user, item.id);
  }

  await createAuditLog({
    userId: user.id,
    entity: "ImportProcessEntry",
    entityId: entryId,
    action: "DELETE",
    oldValue: {
      dealId,
      sortOrder: entry.sortOrder,
      stageNumber: entry.sortOrder + 1,
    },
  });

  await prisma.importProcessEntry.delete({ where: { id: entryId } });
}

export async function uploadImportProcessMedia(
  user: AuthUser,
  dealId: string,
  entryId: string,
  file: File,
) {
  return uploadDealMedia(user, dealId, file, { importProcessEntryId: entryId });
}

export async function setImportProcessEnabled(
  user: AuthUser,
  dealId: string,
  enabled: boolean,
) {
  const existing = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, importProcessEnabled: true },
  });

  if (!existing) {
    throw new Error("NOT_FOUND");
  }

  if (existing.importProcessEnabled === enabled) {
    return { importProcessEnabled: existing.importProcessEnabled };
  }

  const deal = await prisma.deal.update({
    where: { id: dealId },
    data: { importProcessEnabled: enabled },
    select: { importProcessEnabled: true },
  });

  await createAuditLog({
    userId: user.id,
    entity: "Deal",
    entityId: dealId,
    action: enabled ? "IMPORT_PROCESS_ENABLED" : "IMPORT_PROCESS_DISABLED",
    oldValue: { importProcessEnabled: existing.importProcessEnabled },
    newValue: { importProcessEnabled: enabled },
  });

  return deal;
}
