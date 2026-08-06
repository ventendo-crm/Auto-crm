/** Готовые акценты оформления компании (H S% L% без обёртки hsl()). */

export const DEFAULT_BRAND_HSL = "14 100% 67%";
export const CUSTOM_PRESET_ID = "custom";

export interface AppearancePreset {
  id: string;
  name: string;
  description: string;
  /** Акцентный цвет; у custom отсутствует — берётся customBrandHsl */
  brandHsl?: string;
}

export const APPEARANCE_PRESETS: AppearancePreset[] = [
  {
    id: "classic",
    name: "Классика",
    description: "Оранжевый акцент ImportCRM",
    brandHsl: DEFAULT_BRAND_HSL,
  },
  {
    id: "ocean",
    name: "Океан",
    description: "Спокойный голубой",
    brandHsl: "199 89% 48%",
  },
  {
    id: "forest",
    name: "Лес",
    description: "Зелёный",
    brandHsl: "152 55% 38%",
  },
  {
    id: "steel",
    name: "Сталь",
    description: "Нейтральный сине-серый",
    brandHsl: "215 25% 42%",
  },
  {
    id: "amber",
    name: "Янтарь",
    description: "Тёплый жёлтый",
    brandHsl: "38 92% 50%",
  },
  {
    id: CUSTOM_PRESET_ID,
    name: "Свой цвет",
    description: "Выберите акцент вручную",
  },
];

const PRESET_IDS = new Set(APPEARANCE_PRESETS.map((p) => p.id));

export function isAppearancePresetId(value: string): boolean {
  return PRESET_IDS.has(value);
}

export function resolveBrandHsl(presetId: string, customBrandHsl: string | null | undefined): string {
  if (presetId === CUSTOM_PRESET_ID) {
    return isValidBrandHsl(customBrandHsl) ? customBrandHsl! : DEFAULT_BRAND_HSL;
  }
  const preset = APPEARANCE_PRESETS.find((p) => p.id === presetId);
  return preset?.brandHsl ?? DEFAULT_BRAND_HSL;
}

/** "H S% L%" → muted для светлой/тёмной темы */
export function deriveBrandMuted(brandHsl: string, dark: boolean): string {
  const parsed = parseBrandHsl(brandHsl);
  if (!parsed) {
    return dark ? "14 45% 16%" : "14 100% 96%";
  }
  const sat = Math.min(parsed.s, dark ? 45 : 100);
  return dark ? `${parsed.h} ${sat}% 16%` : `${parsed.h} ${sat}% 96%`;
}

const HSL_RE = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/;

export function isValidBrandHsl(value: string | null | undefined): value is string {
  if (!value) return false;
  const m = value.trim().match(HSL_RE);
  if (!m) return false;
  const h = Number(m[1]);
  const s = Number(m[2]);
  const l = Number(m[3]);
  return h >= 0 && h <= 360 && s >= 0 && s <= 100 && l >= 0 && l <= 100;
}

export function parseBrandHsl(value: string): { h: number; s: number; l: number } | null {
  const m = value.trim().match(HSL_RE);
  if (!m) return null;
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}

export function brandHslToHex(brandHsl: string): string {
  const parsed = parseBrandHsl(brandHsl);
  if (!parsed) return "#ff6b35";
  const { h, s, l } = parsed;
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToBrandHsl(hex: string): string {
  const raw = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return DEFAULT_BRAND_HSL;
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      default:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyBrandCssVars(brandHsl: string, dark: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--brand", brandHsl);
  root.style.setProperty("--ring", brandHsl);
  root.style.setProperty("--brand-muted", deriveBrandMuted(brandHsl, dark));
  root.style.setProperty("--brand-foreground", "0 0% 100%");
}

export function clearBrandCssVars() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.removeProperty("--brand");
  root.style.removeProperty("--ring");
  root.style.removeProperty("--brand-muted");
  root.style.removeProperty("--brand-foreground");
}
