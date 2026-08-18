export type ByteRange = { start: number; end: number };

export function parseByteRange(
  header: string | null | undefined,
  size: number,
): ByteRange | "unsatisfiable" | null {
  if (!header || size <= 0) return null;

  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith("bytes=")) return null;

  const spec = trimmed.slice(6).split(",")[0]?.trim() ?? "";
  const match = /^(\d*)-(\d*)$/.exec(spec);
  if (!match) return null;

  const startRaw = match[1];
  const endRaw = match[2];
  if (startRaw === "" && endRaw === "") return null;

  if (startRaw === "") {
    const suffix = Number(endRaw);
    if (!Number.isFinite(suffix) || suffix <= 0) return "unsatisfiable";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(startRaw);
  if (!Number.isFinite(start) || start < 0 || start >= size) return "unsatisfiable";

  const end = endRaw === "" ? size - 1 : Math.min(Number(endRaw), size - 1);
  if (!Number.isFinite(end) || end < start) return "unsatisfiable";

  return { start, end };
}
