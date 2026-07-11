export interface GeocodeResult {
  displayName: string;
  shortName: string;
  latitude: number;
  longitude: number;
}

interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

function buildShortName(item: NominatimItem): string {
  const place =
    item.address?.city ??
    item.address?.town ??
    item.address?.village ??
    item.name ??
    item.display_name.split(",")[0]?.trim();

  const parts = [place, item.address?.country].filter(Boolean);
  return parts.join(", ") || item.display_name;
}

export async function searchPlaces(query: string): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", trimmed);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "6");
  url.searchParams.set("accept-language", "ru");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Auto-CRM/1.0 (https://importcrm.ru; contact: admin@auto-crm.local)",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Geocoding service unavailable");
  }

  const items = (await response.json()) as NominatimItem[];

  return items.map((item) => ({
    displayName: item.display_name,
    shortName: buildShortName(item),
    latitude: Number(item.lat),
    longitude: Number(item.lon),
  }));
}
