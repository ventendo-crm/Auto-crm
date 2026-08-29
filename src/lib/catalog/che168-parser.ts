export type Che168ParsedListing = {
  externalId: string;
  sourceUrl: string;
  titleZh: string;
  descriptionZh: string;
  brand: string | null;
  model: string | null;
  carYear: number | null;
  mileageKm: number | null;
  priceCny: number | null;
  volumeCc: number | null;
  powerHp: number | null;
  fuelType: string | null;
  transmission: string | null;
  color: string | null;
  location: string | null;
  coverImageUrl: string | null;
  galleryUrls: string[];
  videoUrl: string | null;
  rawPayload: Record<string, unknown>;
};

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }
  return null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTitle(html: string): string {
  const og = extractMeta(html, "og:title");
  if (og) return og;
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : "";
}

function extractExternalId(url: string, html: string): string {
  const fromUrl = url.match(/\/(\d+)\.html/i)?.[1];
  if (fromUrl) return fromUrl;
  const infoid = html.match(/infoid\s*[:=]\s*['"]?(\d+)/i)?.[1];
  if (infoid) return infoid;
  const dealerMatch = url.match(/\/(\d+)\/(\d+)\.html/i);
  if (dealerMatch?.[2]) return dealerMatch[2];
  return url;
}

function parsePriceCny(html: string, title: string): number | null {
  const sources = [html, title];
  for (const source of sources) {
    const wanMatch = source.match(/([\d.]+)\s*万\s*元/);
    if (wanMatch?.[1]) {
      const value = Number.parseFloat(wanMatch[1]);
      if (Number.isFinite(value)) return Math.round(value * 10_000);
    }
    const cnyMatch = source.match(/([\d,]+)\s*元/);
    if (cnyMatch?.[1]) {
      const value = Number.parseInt(cnyMatch[1].replace(/,/g, ""), 10);
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

function parseYear(text: string): number | null {
  const match = text.match(/(20\d{2}|19\d{2})\s*年?/);
  if (!match?.[1]) return null;
  const year = Number.parseInt(match[1], 10);
  return year >= 1990 && year <= new Date().getFullYear() + 1 ? year : null;
}

function parseMileageKm(text: string): number | null {
  const wanKm = text.match(/([\d.]+)\s*万公里/);
  if (wanKm?.[1]) {
    const value = Number.parseFloat(wanKm[1]);
    if (Number.isFinite(value)) return Math.round(value * 10_000);
  }
  const km = text.match(/([\d.]+)\s*公里/);
  if (km?.[1]) {
    const value = Number.parseFloat(km[1]);
    if (Number.isFinite(value)) return Math.round(value);
  }
  return null;
}

function parseVolumeCc(text: string): number | null {
  const ccMatch = text.match(/(\d{3,4})\s*cc/i);
  if (ccMatch?.[1]) return Number.parseInt(ccMatch[1], 10);
  const literMatch = text.match(/([\d.]+)\s*[lL]/);
  if (literMatch?.[1]) {
    const liters = Number.parseFloat(literMatch[1]);
    if (Number.isFinite(liters) && liters < 10) return Math.round(liters * 1000);
  }
  return null;
}

function parsePowerHp(text: string): number | null {
  const match = text.match(/(\d{2,4})\s*(?:马力|hp|HP|Ps)/i);
  if (match?.[1]) return Number.parseInt(match[1], 10);
  return null;
}

function extractGalleryUrls(html: string): string[] {
  const urls = new Set<string>();
  const ogImage = extractMeta(html, "og:image");
  if (ogImage) urls.add(ogImage);

  const patterns = [
    /https?:\/\/[^"'\s]+infophoto[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi,
    /https?:\/\/[^"'\s]+autohome[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi,
    /"(https?:\\\/\\\/[^"\\]+?\.(?:jpg|jpeg|png|webp))"/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const raw = match[0].startsWith('"') ? match[1] : match[0];
      if (!raw) continue;
      const url = raw.replace(/\\\//g, "/").replace(/\\u002F/gi, "/");
      if (url.includes("logo") || url.includes("icon")) continue;
      urls.add(url);
    }
  }

  return [...urls].slice(0, 30);
}

function extractVideoUrl(html: string): string | null {
  const match = html.match(/"(https?:[^"]+\.mp4[^"]*)"/i);
  return match?.[1]?.replace(/\\\//g, "/") ?? null;
}

function splitBrandModel(title: string): { brand: string | null; model: string | null } {
  const cleaned = title.replace(/\[[^\]]+\]/g, "").trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return { brand: parts[0] ?? null, model: parts.slice(1, 4).join(" ") || null };
  }
  return { brand: cleaned || null, model: null };
}

function extractSpec(label: string, html: string): string | null {
  const pattern = new RegExp(`${label}[^<]*</[^>]+>\\s*<[^>]+>([^<]+)`, "i");
  const match = html.match(pattern);
  return match?.[1]?.trim() ?? null;
}

export function parseChe168Html(html: string, sourceUrl: string): Che168ParsedListing {
  const titleZh = extractTitle(html);
  const externalId = extractExternalId(sourceUrl, html);
  const descriptionZh =
    extractMeta(html, "description") ??
    extractSpec("车辆描述", html) ??
    extractSpec("车况描述", html) ??
    "";
  const combined = `${titleZh} ${descriptionZh} ${html.slice(0, 8000)}`;
  const { brand, model } = splitBrandModel(titleZh);
  const galleryUrls = extractGalleryUrls(html);
  const coverImageUrl = galleryUrls[0] ?? extractMeta(html, "og:image");

  return {
    externalId,
    sourceUrl,
    titleZh,
    descriptionZh,
    brand,
    model,
    carYear: parseYear(combined),
    mileageKm: parseMileageKm(combined),
    priceCny: parsePriceCny(html, titleZh),
    volumeCc: parseVolumeCc(combined),
    powerHp: parsePowerHp(combined),
    fuelType: extractSpec("燃料", html) ?? extractSpec("燃油", html),
    transmission: extractSpec("变速箱", html) ?? extractSpec("变  速  箱", html),
    color: extractSpec("颜色", html) ?? extractSpec("车身颜色", html),
    location: extractSpec("所在地", html) ?? extractSpec("上牌地", html),
    coverImageUrl: coverImageUrl ?? null,
    galleryUrls,
    videoUrl: extractVideoUrl(html),
    rawPayload: {
      title: titleZh,
      parsedAt: new Date().toISOString(),
      galleryCount: galleryUrls.length,
    },
  };
}

export function normalizeChe168Url(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("EMPTY_URL");
  const withProtocol = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  if (!url.hostname.includes("che168.com")) {
    throw new Error("NOT_CHE168");
  }
  return url.toString();
}
