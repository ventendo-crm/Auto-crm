export function normalizeCatalogTrimIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort();
}

export function catalogTrimIdsKey(ids: string[]): string {
  return normalizeCatalogTrimIds(ids).join(",");
}

export function parseVisibleTrimIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return normalizeCatalogTrimIds(value.filter((item): item is string => typeof item === "string"));
}

export function minCatalogTrimTotal(
  trims: Array<{ estimate: { totalWithCar: number } | null }>,
): { min: number; count: number } | null {
  const totals = trims
    .map((trim) => trim.estimate?.totalWithCar)
    .filter((value): value is number => value != null && Number.isFinite(value));
  if (totals.length === 0) return null;
  return { min: Math.min(...totals), count: totals.length };
}
