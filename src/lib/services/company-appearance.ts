import { unlink } from "fs/promises";
import path from "path";
import {
  APPEARANCE_PRESETS,
  CUSTOM_PRESET_ID,
  isAppearancePresetId,
  isValidBrandHsl,
  resolveBrandHsl,
} from "@/lib/appearance/presets";
import { prisma } from "@/lib/prisma";
import { isLocalUploadUrl, localUploadFilePath } from "@/lib/storage/local-uploads";

export interface CompanyAppearanceDto {
  companyId: string;
  presetId: string;
  customBrandHsl: string | null;
  brandHsl: string;
  logoUrl: string | null;
  hasLogo: boolean;
  updatedAt: string | null;
  presets: Array<{ id: string; name: string; description: string; brandHsl?: string }>;
}

function serialize(
  companyId: string,
  presetId: string,
  customBrandHsl: string | null,
  logoUrl: string | null,
  updatedAt: Date | null,
): Omit<CompanyAppearanceDto, "presets"> {
  return {
    companyId,
    presetId,
    customBrandHsl,
    brandHsl: resolveBrandHsl(presetId, customBrandHsl),
    logoUrl,
    hasLogo: Boolean(logoUrl),
    updatedAt: updatedAt?.toISOString() ?? null,
  };
}

function withPresets(dto: Omit<CompanyAppearanceDto, "presets">): CompanyAppearanceDto {
  return { ...dto, presets: APPEARANCE_PRESETS };
}

export async function ensureCompanyAppearanceSettings(
  companyId: string,
): Promise<CompanyAppearanceDto> {
  const existing = await prisma.companyAppearanceSettings.findUnique({
    where: { companyId },
  });

  if (existing) {
    return withPresets(
      serialize(
        companyId,
        existing.presetId,
        existing.customBrandHsl,
        existing.logoUrl,
        existing.updatedAt,
      ),
    );
  }

  const created = await prisma.companyAppearanceSettings.create({
    data: { companyId },
  });

  return withPresets(
    serialize(
      companyId,
      created.presetId,
      created.customBrandHsl,
      created.logoUrl,
      created.updatedAt,
    ),
  );
}

export async function getCompanyAppearance(companyId: string): Promise<CompanyAppearanceDto> {
  return ensureCompanyAppearanceSettings(companyId);
}

export async function saveCompanyAppearance(
  companyId: string,
  input: { presetId: string; customBrandHsl?: string | null },
): Promise<CompanyAppearanceDto> {
  if (!isAppearancePresetId(input.presetId)) {
    throw new Error("Неизвестный пресет оформления");
  }

  let customBrandHsl: string | null = null;
  if (input.presetId === CUSTOM_PRESET_ID) {
    const value = input.customBrandHsl?.trim() ?? "";
    if (!isValidBrandHsl(value)) {
      throw new Error("Укажите корректный цвет акцента");
    }
    customBrandHsl = value;
  } else if (input.customBrandHsl && isValidBrandHsl(input.customBrandHsl.trim())) {
    customBrandHsl = input.customBrandHsl.trim();
  }

  await ensureCompanyAppearanceSettings(companyId);

  const record = await prisma.companyAppearanceSettings.update({
    where: { companyId },
    data: {
      presetId: input.presetId,
      customBrandHsl,
    },
  });

  return withPresets(
    serialize(
      companyId,
      record.presetId,
      record.customBrandHsl,
      record.logoUrl,
      record.updatedAt,
    ),
  );
}

export async function setCompanyAppearanceLogo(
  companyId: string,
  fileUrl: string,
): Promise<CompanyAppearanceDto> {
  await ensureCompanyAppearanceSettings(companyId);
  const existing = await prisma.companyAppearanceSettings.findUnique({
    where: { companyId },
  });
  if (existing?.logoUrl) {
    await deleteAppearanceLogoFile(existing.logoUrl);
  }

  const record = await prisma.companyAppearanceSettings.update({
    where: { companyId },
    data: { logoUrl: fileUrl },
  });

  return withPresets(
    serialize(
      companyId,
      record.presetId,
      record.customBrandHsl,
      record.logoUrl,
      record.updatedAt,
    ),
  );
}

export async function clearCompanyAppearanceLogo(
  companyId: string,
): Promise<CompanyAppearanceDto> {
  await ensureCompanyAppearanceSettings(companyId);
  const existing = await prisma.companyAppearanceSettings.findUnique({
    where: { companyId },
  });
  if (existing?.logoUrl) {
    await deleteAppearanceLogoFile(existing.logoUrl);
  }

  const record = await prisma.companyAppearanceSettings.update({
    where: { companyId },
    data: { logoUrl: null },
  });

  return withPresets(
    serialize(
      companyId,
      record.presetId,
      record.customBrandHsl,
      record.logoUrl,
      record.updatedAt,
    ),
  );
}

async function deleteAppearanceLogoFile(fileUrl: string) {
  if (!isLocalUploadUrl(fileUrl)) return;
  const filePath = localUploadFilePath(fileUrl);
  if (!path.basename(filePath).startsWith("company-logo-")) return;
  await unlink(filePath).catch(() => undefined);
}
