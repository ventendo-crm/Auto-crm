import brandLogoImage from "@/assets/brand-logo.png";

/** Raster logo bundled by Next.js (URL includes content hash after each build). */
export const BRAND_ICON_SRC = brandLogoImage.src;
export const BRAND_ICON_MIME = "image/png";

/** Static path for service worker / push (keep public/brand-logo.png in sync). */
export const BRAND_ICON_PUBLIC_PATH = "/brand-logo.png";
export const BRAND_ICON_PUBLIC_VERSION = 12;

export function getBrandIconUrl(): string {
  return BRAND_ICON_SRC;
}

export function getBrandIconPublicUrl(): string {
  return `${BRAND_ICON_PUBLIC_PATH}?v=${BRAND_ICON_PUBLIC_VERSION}`;
}
