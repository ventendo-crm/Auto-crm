import { createHash, randomBytes } from "crypto";
import { createReadStream } from "fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { parseOfferEquipmentKeys, snapshotOfferEquipment } from "@/lib/calculator/offer-equipment";
import {
  assertSafeOfferFileName,
  normalizeOfferMeta,
  type OfferItemMeta,
  type OfferMetaV2,
} from "@/lib/calculator/offer-meta";
import {
  OFFER_DESCRIPTION_MAX,
  OFFER_MAX_ITEMS,
  OFFER_MAX_PHOTO_BYTES,
  OFFER_MAX_PHOTOS,
  OFFER_MAX_TOTAL_BYTES,
  OFFER_SELECTION_TITLE_MAX,
  OFFER_TTL_MS,
  OFFER_VEHICLE_TITLE_MAX,
  isOfferShareToken,
  publicOfferFilePath,
  sanitizeOfferHttpUrl,
  type PublicCalculatorOffer,
  type PublicCalculatorOfferItem,
} from "@/lib/calculator/offer-share";
import type { AuthUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCompanyWorkspaceSettings } from "@/lib/services/company-workspace";
import { guessUploadContentType, localUploadsDir, uploadContentDisposition } from "@/lib/storage/local-uploads";

const ALLOWED_PHOTO_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export { assertSafeOfferFileName, normalizeOfferMeta };

export function createOfferToken(): string {
  return randomBytes(24).toString("hex");
}

function hashOfferToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

function offersRootDir(): string {
  return path.join(localUploadsDir(), "offers");
}

function offerDirForToken(token: string): string {
  return path.join(offersRootDir(), hashOfferToken(token));
}

function extensionForMime(mime: string, fallback = "jpg"): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/jpeg") return "jpg";
  return fallback;
}

async function readOfferMeta(dir: string): Promise<OfferMetaV2> {
  const raw = await readFile(path.join(dir, "meta.json"), "utf8");
  return normalizeOfferMeta(JSON.parse(raw));
}

function itemHasContent(item: {
  vehicleTitle?: string | null;
  description: string;
  equipmentKeys: unknown[];
  sourceUrl: string | null;
  photos: unknown[];
  estimate: unknown;
}) {
  return Boolean(
    item.vehicleTitle?.trim() ||
      item.description.trim() ||
      item.equipmentKeys.length > 0 ||
      item.sourceUrl ||
      item.photos.length > 0 ||
      item.estimate,
  );
}

async function pruneExpiredOffers() {
  const root = offersRootDir();
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }

  const now = Date.now();
  let checked = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    checked += 1;
    if (checked > 40) break;
    const dir = path.join(root, entry.name);
    try {
      const meta = await readOfferMeta(dir);
      if (new Date(meta.expiresAt).getTime() <= now) {
        await rm(dir, { recursive: true, force: true });
      }
    } catch {
      // битый каталог не трогаем
    }
  }
}

type ParsedOfferItem = {
  vehicleTitle: string;
  description: string;
  equipmentKeys: string[];
  sourceUrl: string | null;
  totalLabel: string | null;
  photos: File[];
  estimate: File | null;
};

function fileFromFormValue(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 ? value : null;
}

function parseIndexedOfferItems(formData: FormData): ParsedOfferItem[] | null {
  const indices = new Set<number>();
  for (const key of formData.keys()) {
    const match = /^(?:photos|estimate|vehicleTitle|description|sourceUrl|totalLabel|equipment)-(\d+)$/.exec(key);
    if (match) indices.add(Number(match[1]));
  }
  if (indices.size === 0) return null;
  if (indices.size > OFFER_MAX_ITEMS) {
    throw new Error(`Не больше ${OFFER_MAX_ITEMS} авто в одной подборке`);
  }

  return [...indices]
    .sort((a, b) => a - b)
    .map((index) => {
      const photos = formData
        .getAll(`photos-${index}`)
        .filter((item): item is File => item instanceof File && item.size > 0);
      return {
        vehicleTitle: String(formData.get(`vehicleTitle-${index}`) ?? "")
          .trim()
          .slice(0, OFFER_VEHICLE_TITLE_MAX),
        description: String(formData.get(`description-${index}`) ?? "")
          .trim()
          .slice(0, OFFER_DESCRIPTION_MAX),
        equipmentKeys: parseOfferEquipmentKeys(formData.get(`equipment-${index}`)),
        sourceUrl: sanitizeOfferHttpUrl(String(formData.get(`sourceUrl-${index}`) ?? "")),
        totalLabel: String(formData.get(`totalLabel-${index}`) ?? "")
          .trim()
          .slice(0, 80) || null,
        photos,
        estimate: fileFromFormValue(formData.get(`estimate-${index}`)),
      };
    });
}

function parseLegacyOfferItem(formData: FormData): ParsedOfferItem {
  const photos = formData.getAll("photos").filter((item): item is File => item instanceof File && item.size > 0);
  return {
    vehicleTitle: String(formData.get("vehicleTitle") ?? "")
      .trim()
      .slice(0, OFFER_VEHICLE_TITLE_MAX),
    description: String(formData.get("description") ?? "")
      .trim()
      .slice(0, OFFER_DESCRIPTION_MAX),
    equipmentKeys: parseOfferEquipmentKeys(formData.get("equipment")),
    sourceUrl: sanitizeOfferHttpUrl(String(formData.get("sourceUrl") ?? "")),
    totalLabel: String(formData.get("totalLabel") ?? "").trim().slice(0, 80) || null,
    photos,
    estimate: fileFromFormValue(formData.get("estimate")),
  };
}

function validateOfferItemFiles(item: ParsedOfferItem) {
  if (item.photos.length > OFFER_MAX_PHOTOS) {
    throw new Error(`Не больше ${OFFER_MAX_PHOTOS} фото у одного авто`);
  }
  let totalBytes = 0;
  for (const photo of item.photos) {
    if (photo.size > OFFER_MAX_PHOTO_BYTES) {
      throw new Error("Каждое фото должно быть до 8 МБ");
    }
    const mime = photo.type || guessUploadContentType(photo.name);
    if (!ALLOWED_PHOTO_MIME.has(mime)) {
      throw new Error("Допустимы JPEG, PNG, WebP или GIF");
    }
    totalBytes += photo.size;
  }
  if (item.estimate) {
    if (item.estimate.size > OFFER_MAX_PHOTO_BYTES) {
      throw new Error("Картинка расчёта должна быть до 8 МБ");
    }
    const mime = item.estimate.type || guessUploadContentType(item.estimate.name);
    if (mime !== "image/jpeg" && mime !== "image/png") {
      throw new Error("Расчёт нужно отправить картинкой JPEG");
    }
    totalBytes += item.estimate.size;
  }
  return totalBytes;
}

function allowedFilesFromMeta(meta: OfferMetaV2): Set<string> {
  const allowed = new Set<string>();
  for (const item of meta.items) {
    for (const fileName of item.photos) allowed.add(fileName);
    if (item.estimateFile) allowed.add(item.estimateFile);
  }
  return allowed;
}

export async function createCalculatorOffer(
  user: AuthUser,
  formData: FormData,
): Promise<{ token: string; expiresAt: string }> {
  const selectionTitle = String(formData.get("selectionTitle") ?? "")
    .trim()
    .slice(0, OFFER_SELECTION_TITLE_MAX);
  const parsedItems = parseIndexedOfferItems(formData) ?? [parseLegacyOfferItem(formData)];
  const items = parsedItems.filter(itemHasContent);
  if (items.length === 0) {
    throw new Error("Добавьте марку, комплектацию, описание, фото или расчёт");
  }
  if (items.length > OFFER_MAX_ITEMS) {
    throw new Error(`Не больше ${OFFER_MAX_ITEMS} авто в одной подборке`);
  }

  let totalBytes = 0;
  for (const item of items) {
    totalBytes += validateOfferItemFiles(item);
  }
  if (totalBytes > OFFER_MAX_TOTAL_BYTES) {
    throw new Error("Слишком большой набор файлов — уберите часть фото");
  }

  const [company, workspace] = await Promise.all([
    prisma.company.findUnique({
      where: { id: user.companyId },
      select: { name: true },
    }),
    getCompanyWorkspaceSettings(user.companyId),
  ]);
  if (!company) {
    throw new Error("Not found");
  }

  const token = createOfferToken();
  const dir = offerDirForToken(token);
  await mkdir(dir, { recursive: true });

  const savedItems: OfferItemMeta[] = [];
  for (const [itemIndex, item] of items.entries()) {
    const prefix = `i${String(itemIndex + 1).padStart(2, "0")}-`;
    const savedPhotos: string[] = [];
    for (const [photoIndex, photo] of item.photos.entries()) {
      const mime = photo.type || guessUploadContentType(photo.name);
      const ext = extensionForMime(mime);
      const fileName = `${prefix}photo-${String(photoIndex + 1).padStart(2, "0")}.${ext}`;
      assertSafeOfferFileName(fileName);
      await writeFile(path.join(dir, fileName), Buffer.from(await photo.arrayBuffer()));
      savedPhotos.push(fileName);
    }

    let estimateFile: string | null = null;
    if (item.estimate) {
      estimateFile = `${prefix}estimate.jpg`;
      assertSafeOfferFileName(estimateFile);
      await writeFile(path.join(dir, estimateFile), Buffer.from(await item.estimate.arrayBuffer()));
    }

    savedItems.push({
      vehicleTitle: item.vehicleTitle || null,
      description: item.description,
      equipment: snapshotOfferEquipment(item.equipmentKeys, workspace.offerEquipmentGroups),
      sourceUrl: item.sourceUrl,
      totalLabel: item.totalLabel,
      photos: savedPhotos,
      estimateFile,
    });
  }

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + OFFER_TTL_MS);
  const meta: OfferMetaV2 = {
    version: 2,
    companyId: user.companyId,
    companyName: company.name,
    createdByUserId: user.id,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    selectionTitle: selectionTitle || null,
    items: savedItems,
  };
  await writeFile(path.join(dir, "meta.json"), JSON.stringify(meta), "utf8");

  void pruneExpiredOffers();

  return { token, expiresAt: meta.expiresAt };
}

export async function getPublicCalculatorOffer(token: string): Promise<PublicCalculatorOffer> {
  if (!isOfferShareToken(token)) {
    throw new Error("NOT_FOUND");
  }

  const dir = offerDirForToken(token);
  let meta: OfferMetaV2;
  try {
    meta = await readOfferMeta(dir);
  } catch {
    throw new Error("NOT_FOUND");
  }

  if (new Date(meta.expiresAt).getTime() <= Date.now()) {
    throw new Error("EXPIRED");
  }

  const items: PublicCalculatorOfferItem[] = meta.items.map((item) => ({
    vehicleTitle: item.vehicleTitle?.trim() ? item.vehicleTitle.trim() : null,
    description: item.description,
    equipment: item.equipment,
    sourceUrl: item.sourceUrl,
    totalLabel: item.totalLabel,
    photoUrls: item.photos.map((fileName) => publicOfferFilePath(token, fileName)),
    estimateUrl: item.estimateFile ? publicOfferFilePath(token, item.estimateFile) : null,
  }));

  return {
    companyName: meta.companyName,
    selectionTitle: meta.selectionTitle?.trim() ? meta.selectionTitle.trim() : null,
    items,
    expiresAt: meta.expiresAt,
  };
}

export async function openPublicOfferFile(
  token: string,
  fileName: string,
): Promise<{
  stream: ReadableStream;
  contentType: string;
  fileName: string;
  size: number;
  downloadName: string;
}> {
  if (!isOfferShareToken(token)) {
    throw new Error("NOT_FOUND");
  }

  const safeName = assertSafeOfferFileName(fileName);
  const dir = offerDirForToken(token);
  let meta: OfferMetaV2;
  try {
    meta = await readOfferMeta(dir);
  } catch {
    throw new Error("NOT_FOUND");
  }

  if (new Date(meta.expiresAt).getTime() <= Date.now()) {
    throw new Error("EXPIRED");
  }

  const allowed = allowedFilesFromMeta(meta);
  if (!allowed.has(safeName)) {
    throw new Error("NOT_FOUND");
  }

  const filePath = path.resolve(dir, safeName);
  const relative = path.relative(path.resolve(dir), filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("NOT_FOUND");
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    throw new Error("NOT_FOUND");
  }

  return {
    stream: Readable.toWeb(createReadStream(filePath)) as ReadableStream,
    contentType: guessUploadContentType(safeName),
    fileName: safeName,
    size: fileStat.size,
    downloadName: safeName,
  };
}

export { uploadContentDisposition };
