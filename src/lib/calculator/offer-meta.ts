import type { OfferEquipmentItem } from "@/lib/calculator/offer-equipment";
import { parseOfferMileageKm } from "@/lib/calculator/offer-share";

export const SAFE_OFFER_FILE =
  /^(?:i\d{2}-)?(?:photo-\d{2}|estimate)\.(jpe?g|png|webp|gif)$/;

export type OfferItemMeta = {
  vehicleTitle: string | null;
  mileageKm: number | null;
  description: string;
  equipment: OfferEquipmentItem[];
  sourceUrl: string | null;
  totalLabel: string | null;
  photos: string[];
  estimateFile: string | null;
};

export type OfferMetaV1 = {
  version: 1;
  companyId: string;
  companyName: string;
  createdByUserId: string;
  createdAt: string;
  expiresAt: string;
  description: string;
  vehicleTitle?: string | null;
  sourceUrl: string | null;
  totalLabel: string | null;
  photos: string[];
  estimateFile: string | null;
};

export type OfferMetaV2 = {
  version: 2;
  companyId: string;
  companyName: string;
  createdByUserId: string;
  createdAt: string;
  expiresAt: string;
  selectionTitle: string | null;
  items: OfferItemMeta[];
};

type OfferMeta = OfferMetaV1 | OfferMetaV2;

export function assertSafeOfferFileName(fileName: string): string {
  const decoded = decodeURIComponent(fileName).trim();
  if (!SAFE_OFFER_FILE.test(decoded) || decoded.includes("/") || decoded.includes("\\")) {
    throw new Error("Not found");
  }
  return decoded;
}

function isOfferEquipmentItem(value: unknown): value is OfferEquipmentItem {
  if (!value || typeof value !== "object") return false;
  const item = value as OfferEquipmentItem;
  return typeof item.key === "string" && typeof item.label === "string";
}

function isOfferItemMeta(value: unknown): value is OfferItemMeta {
  if (!value || typeof value !== "object") return false;
  const item = value as OfferItemMeta;
  if (typeof item.description !== "string" || !Array.isArray(item.photos)) return false;
  if (!item.photos.every((name) => typeof name === "string")) return false;
  if (item.equipment !== undefined) {
    if (!Array.isArray(item.equipment) || !item.equipment.every(isOfferEquipmentItem)) return false;
  }
  if (item.mileageKm !== undefined && item.mileageKm !== null && typeof item.mileageKm !== "number") {
    return false;
  }
  return true;
}

function normalizeOfferItem(item: OfferItemMeta): OfferItemMeta {
  const equipment = Array.isArray(item.equipment)
    ? item.equipment
        .filter(isOfferEquipmentItem)
        .map((entry) => ({
          key: entry.key.trim().slice(0, 63),
          label: entry.label.trim().slice(0, 200),
        }))
        .filter((entry) => entry.key && entry.label)
    : [];
  return { ...item, equipment, mileageKm: parseOfferMileageKm(item.mileageKm) };
}

export function normalizeOfferMeta(parsed: unknown): OfferMetaV2 {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("NOT_FOUND");
  }
  const raw = parsed as OfferMeta;
  if (raw.version === 2 && Array.isArray(raw.items) && raw.items.every(isOfferItemMeta)) {
    return { ...raw, items: raw.items.map(normalizeOfferItem) };
  }
  if (raw.version === 1 && Array.isArray(raw.photos)) {
    const v1 = raw as OfferMetaV1;
    return {
      version: 2,
      companyId: v1.companyId,
      companyName: v1.companyName,
      createdByUserId: v1.createdByUserId,
      createdAt: v1.createdAt,
      expiresAt: v1.expiresAt,
      selectionTitle: v1.vehicleTitle?.trim() ? v1.vehicleTitle.trim() : null,
      items: [
        {
          vehicleTitle: v1.vehicleTitle?.trim() ? v1.vehicleTitle.trim() : null,
          mileageKm: null,
          description: v1.description,
          equipment: [],
          sourceUrl: v1.sourceUrl,
          totalLabel: v1.totalLabel,
          photos: v1.photos,
          estimateFile: v1.estimateFile,
        },
      ],
    };
  }
  throw new Error("NOT_FOUND");
}
