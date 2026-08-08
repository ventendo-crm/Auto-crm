import {
  isSystemOriginCountry,
  SYSTEM_ORIGIN_COUNTRIES,
  SystemOriginCountry,
} from "@/lib/customs-calculator/rates";

export type CustomOriginCalcProfile = "china";

export interface CustomCalculatorOrigin {
  id: string;
  label: string;
  calcProfile: CustomOriginCalcProfile;
}

export const CUSTOM_ORIGIN_ID_RE = /^custom_[a-z0-9_]{1,48}$/;

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < bytes; i += 1) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(arr, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isCustomOriginId(value: string): boolean {
  return CUSTOM_ORIGIN_ID_RE.test(value);
}

export function createCustomOriginId(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);

  if (base.length > 0) {
    return `custom_${base}`;
  }

  return `custom_${randomHex(4)}`;
}

export function ensureUniqueCustomOriginId(
  preferredId: string,
  existingIds: Set<string>,
): string {
  let id = preferredId;
  if (!existingIds.has(id) && !isSystemOriginCountry(id)) {
    return id;
  }
  for (let i = 2; i < 100; i += 1) {
    const next = `${preferredId}_${i}`.slice(0, 56);
    if (!existingIds.has(next) && !isSystemOriginCountry(next)) {
      return next;
    }
  }
  return `custom_${randomHex(6)}`;
}

export function normalizeCustomOrigins(value: unknown): CustomCalculatorOrigin[] {
  if (!Array.isArray(value)) return [];
  const result: CustomCalculatorOrigin[] = [];
  const seen = new Set<string>();

  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<CustomCalculatorOrigin>;
    if (typeof item.id !== "string" || typeof item.label !== "string") continue;
    const id = item.id.trim();
    const label = item.label.trim();
    if (!isCustomOriginId(id) || isSystemOriginCountry(id) || !label || seen.has(id)) {
      continue;
    }
    seen.add(id);
    result.push({
      id,
      label: label.slice(0, 80),
      calcProfile: "china",
    });
  }

  return result;
}

export function systemOriginOptions(): Array<{ value: SystemOriginCountry; label: string }> {
  return [
    { value: "china", label: "Китай" },
    { value: "korea", label: "Корея" },
    { value: "kyrgyzstan", label: "Киргизия" },
  ];
}

export function buildOriginOptions(
  customOrigins: CustomCalculatorOrigin[],
): Array<{ value: string; label: string }> {
  return [
    ...systemOriginOptions(),
    ...customOrigins.map((item) => ({ value: item.id, label: item.label })),
  ];
}

/** Подпись страны экспорта для отображения (id или старый свободный текст). */
export function resolveOriginLabel(
  value: string,
  customOrigins: CustomCalculatorOrigin[] = [],
): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const match = buildOriginOptions(customOrigins).find(
    (option) => option.value === trimmed || option.label === trimmed,
  );
  return match?.label ?? trimmed;
}

/**
 * Приводит сохранённое значение к id опции (china / korea / …).
 * Старые сделки со свободным текстом «Китай» → china; неизвестное остаётся как есть.
 */
export function coerceOriginSelectValue(
  value: string,
  customOrigins: CustomCalculatorOrigin[] = [],
): string {
  const trimmed = value.trim();
  if (!trimmed) return "china";
  const match = buildOriginOptions(customOrigins).find(
    (option) => option.value === trimmed || option.label === trimmed,
  );
  return match?.value ?? trimmed;
}

export { SYSTEM_ORIGIN_COUNTRIES };
