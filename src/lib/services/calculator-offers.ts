import { createHash, randomBytes } from "crypto";
import { createReadStream } from "fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import {
  OFFER_DESCRIPTION_MAX,
  OFFER_MAX_PHOTO_BYTES,
  OFFER_MAX_PHOTOS,
  OFFER_MAX_TOTAL_BYTES,
  OFFER_TTL_MS,
  isOfferShareToken,
  publicOfferFilePath,
  sanitizeOfferHttpUrl,
  type PublicCalculatorOffer,
} from "@/lib/calculator/offer-share";
import type { AuthUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { guessUploadContentType, localUploadsDir, uploadContentDisposition } from "@/lib/storage/local-uploads";

const ALLOWED_PHOTO_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const SAFE_OFFER_FILE = /^(photo-\d{2}|estimate)\.(jpe?g|png|webp|gif)$/;

type OfferMetaV1 = {
  version: 1;
  companyId: string;
  companyName: string;
  createdByUserId: string;
  createdAt: string;
  expiresAt: string;
  description: string;
  sourceUrl: string | null;
  totalLabel: string | null;
  photos: string[];
  estimateFile: string | null;
};

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

export function assertSafeOfferFileName(fileName: string): string {
  const decoded = decodeURIComponent(fileName).trim();
  if (!SAFE_OFFER_FILE.test(decoded) || decoded.includes("/") || decoded.includes("\\")) {
    throw new Error("Not found");
  }
  return decoded;
}

function extensionForMime(mime: string, fallback = "jpg"): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/jpeg") return "jpg";
  return fallback;
}

async function readOfferMeta(dir: string): Promise<OfferMetaV1> {
  const raw = await readFile(path.join(dir, "meta.json"), "utf8");
  const parsed = JSON.parse(raw) as OfferMetaV1;
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.photos)) {
    throw new Error("NOT_FOUND");
  }
  return parsed;
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

export async function createCalculatorOffer(
  user: AuthUser,
  formData: FormData,
): Promise<{ token: string; expiresAt: string }> {
  const description = String(formData.get("description") ?? "")
    .trim()
    .slice(0, OFFER_DESCRIPTION_MAX);
  const sourceUrl = sanitizeOfferHttpUrl(String(formData.get("sourceUrl") ?? ""));
  const totalLabelRaw = String(formData.get("totalLabel") ?? "").trim();
  const totalLabel = totalLabelRaw ? totalLabelRaw.slice(0, 80) : null;

  const photos = formData.getAll("photos").filter((item): item is File => item instanceof File);
  const estimateRaw = formData.get("estimate");
  const estimate = estimateRaw instanceof File && estimateRaw.size > 0 ? estimateRaw : null;

  if (photos.length > OFFER_MAX_PHOTOS) {
    throw new Error(`Не больше ${OFFER_MAX_PHOTOS} фото`);
  }

  if (!description && !sourceUrl && photos.length === 0 && !estimate) {
    throw new Error("Добавьте описание, фото или расчёт");
  }

  let totalBytes = 0;
  for (const photo of photos) {
    if (photo.size <= 0 || photo.size > OFFER_MAX_PHOTO_BYTES) {
      throw new Error("Каждое фото должно быть до 8 МБ");
    }
    const mime = photo.type || guessUploadContentType(photo.name);
    if (!ALLOWED_PHOTO_MIME.has(mime)) {
      throw new Error("Допустимы JPEG, PNG, WebP или GIF");
    }
    totalBytes += photo.size;
  }

  if (estimate) {
    if (estimate.size <= 0 || estimate.size > OFFER_MAX_PHOTO_BYTES) {
      throw new Error("Картинка расчёта должна быть до 8 МБ");
    }
    const mime = estimate.type || guessUploadContentType(estimate.name);
    if (mime !== "image/jpeg" && mime !== "image/png") {
      throw new Error("Расчёт нужно отправить картинкой JPEG");
    }
    totalBytes += estimate.size;
  }

  if (totalBytes > OFFER_MAX_TOTAL_BYTES) {
    throw new Error("Слишком большой набор файлов — уберите часть фото");
  }

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { name: true },
  });
  if (!company) {
    throw new Error("Not found");
  }

  const token = createOfferToken();
  const dir = offerDirForToken(token);
  await mkdir(dir, { recursive: true });

  const savedPhotos: string[] = [];
  for (const [index, photo] of photos.entries()) {
    const mime = photo.type || guessUploadContentType(photo.name);
    const ext = extensionForMime(mime);
    const fileName = `photo-${String(index + 1).padStart(2, "0")}.${ext}`;
    await writeFile(path.join(dir, fileName), Buffer.from(await photo.arrayBuffer()));
    savedPhotos.push(fileName);
  }

  let estimateFile: string | null = null;
  if (estimate) {
    estimateFile = "estimate.jpg";
    await writeFile(path.join(dir, estimateFile), Buffer.from(await estimate.arrayBuffer()));
  }

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + OFFER_TTL_MS);
  const meta: OfferMetaV1 = {
    version: 1,
    companyId: user.companyId,
    companyName: company.name,
    createdByUserId: user.id,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    description,
    sourceUrl,
    totalLabel,
    photos: savedPhotos,
    estimateFile,
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
  let meta: OfferMetaV1;
  try {
    meta = await readOfferMeta(dir);
  } catch {
    throw new Error("NOT_FOUND");
  }

  if (new Date(meta.expiresAt).getTime() <= Date.now()) {
    throw new Error("EXPIRED");
  }

  return {
    companyName: meta.companyName,
    description: meta.description,
    sourceUrl: meta.sourceUrl,
    totalLabel: meta.totalLabel,
    photoUrls: meta.photos.map((fileName) => publicOfferFilePath(token, fileName)),
    estimateUrl: meta.estimateFile ? publicOfferFilePath(token, meta.estimateFile) : null,
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
  let meta: OfferMetaV1;
  try {
    meta = await readOfferMeta(dir);
  } catch {
    throw new Error("NOT_FOUND");
  }

  if (new Date(meta.expiresAt).getTime() <= Date.now()) {
    throw new Error("EXPIRED");
  }

  const allowed = new Set(meta.photos);
  if (meta.estimateFile) allowed.add(meta.estimateFile);
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
