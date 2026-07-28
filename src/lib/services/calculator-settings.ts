import { Prisma } from "@prisma/client";
import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { isLocalUploadUrl, localUploadFilePath } from "@/lib/storage/local-uploads";
import type { CalculatorPresetInput } from "@/lib/validators/calculator-settings";

export interface CalculatorSettingsDto {
  presets: CalculatorPresetInput[];
  exportLogoUrl: string | null;
  updatedAt: string | null;
}

function serializeSettings(record: {
  presets: Prisma.JsonValue;
  exportLogoUrl: string | null;
  updatedAt: Date;
}): CalculatorSettingsDto {
  return {
    presets: Array.isArray(record.presets)
      ? (record.presets as unknown as CalculatorPresetInput[])
      : [],
    exportLogoUrl: record.exportLogoUrl,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function getCalculatorSettings(userId: string): Promise<CalculatorSettingsDto> {
  const record = await prisma.userCalculatorSettings.findUnique({
    where: { userId },
  });

  if (!record) {
    return { presets: [], exportLogoUrl: null, updatedAt: null };
  }

  return serializeSettings(record);
}

export async function upsertCalculatorPresets(
  userId: string,
  presets: CalculatorPresetInput[],
): Promise<CalculatorSettingsDto> {
  const record = await prisma.userCalculatorSettings.upsert({
    where: { userId },
    create: {
      userId,
      presets: presets as unknown as Prisma.InputJsonValue,
    },
    update: {
      presets: presets as unknown as Prisma.InputJsonValue,
    },
  });

  return serializeSettings(record);
}

export async function setCalculatorExportLogo(
  userId: string,
  exportLogoUrl: string,
): Promise<CalculatorSettingsDto> {
  const existing = await prisma.userCalculatorSettings.findUnique({
    where: { userId },
    select: { exportLogoUrl: true },
  });

  if (existing?.exportLogoUrl && existing.exportLogoUrl !== exportLogoUrl) {
    await deleteLogoFile(existing.exportLogoUrl);
  }

  const record = await prisma.userCalculatorSettings.upsert({
    where: { userId },
    create: {
      userId,
      presets: [],
      exportLogoUrl,
    },
    update: {
      exportLogoUrl,
    },
  });

  return serializeSettings(record);
}

export async function clearCalculatorExportLogo(userId: string): Promise<CalculatorSettingsDto> {
  const existing = await prisma.userCalculatorSettings.findUnique({
    where: { userId },
  });

  if (!existing) {
    return { presets: [], exportLogoUrl: null, updatedAt: null };
  }

  if (existing.exportLogoUrl) {
    await deleteLogoFile(existing.exportLogoUrl);
  }

  const record = await prisma.userCalculatorSettings.update({
    where: { userId },
    data: { exportLogoUrl: null },
  });

  return serializeSettings(record);
}

async function deleteLogoFile(fileUrl: string) {
  if (!isLocalUploadUrl(fileUrl)) return;
  const filePath = localUploadFilePath(fileUrl);
  // Only remove calc-logo-* files to avoid deleting unrelated uploads
  if (!path.basename(filePath).startsWith("calc-logo-")) return;
  await unlink(filePath).catch(() => undefined);
}
