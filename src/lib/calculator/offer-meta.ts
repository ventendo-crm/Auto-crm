export const SAFE_OFFER_FILE =
  /^(?:i\d{2}-)?(?:photo-\d{2}|estimate)\.(jpe?g|png|webp|gif)$/;

export type OfferItemMeta = {
  vehicleTitle: string | null;
  description: string;
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

function isOfferItemMeta(value: unknown): value is OfferItemMeta {
  if (!value || typeof value !== "object") return false;
  const item = value as OfferItemMeta;
  return (
    typeof item.description === "string" &&
    Array.isArray(item.photos) &&
    item.photos.every((name) => typeof name === "string")
  );
}

export function normalizeOfferMeta(parsed: unknown): OfferMetaV2 {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("NOT_FOUND");
  }
  const raw = parsed as OfferMeta;
  if (raw.version === 2 && Array.isArray(raw.items) && raw.items.every(isOfferItemMeta)) {
    return raw;
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
          description: v1.description,
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
