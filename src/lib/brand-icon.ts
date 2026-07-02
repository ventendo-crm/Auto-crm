export const BRAND_ICON_VIEWBOX = "0 0 64 64";
export const BRAND_ICON_FILL = "#FF7F5C";
export const BRAND_ICON_ACCENT = "#E85F3A";

export const BRAND_ICON_BODY_PATH =
  "M16 39.5c0-1.4 1.1-2.5 2.5-2.5h2l2.7-4.8c0.4-0.8 1.2-1.2 2-1.2h17.4c0.8 0 1.6 0.4 2 1.2l2.7 4.8h2c1.4 0 2.5 1.1 2.5 2.5V43H16V39.5zm5-9.3 2.3-4.1h19.4l2.3 4.1H21z";

export const BRAND_ICON_WINDSHIELD_PATH = "M25.5 28h13l1.7 3.1H23.8L25.5 28z";

export const BRAND_ICON_WHEELS = [
  { cx: 22.5, cy: 41, r: 2.8 },
  { cx: 41.5, cy: 41, r: 2.8 },
] as const;

export function getBrandIconSvgMarkup(label = "ImportCRM"): string {
  const wheels = BRAND_ICON_WHEELS.map(
    (wheel) => `<circle cx="${wheel.cx}" cy="${wheel.cy}" r="${wheel.r}" fill="#FFFFFF"/>`,
  ).join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_ICON_VIEWBOX}" fill="none" role="img" aria-label="${label}">
  <rect width="64" height="64" rx="14" fill="${BRAND_ICON_FILL}"/>
  <path fill="#FFFFFF" d="${BRAND_ICON_BODY_PATH}"/>
  <path fill="${BRAND_ICON_ACCENT}" d="${BRAND_ICON_WINDSHIELD_PATH}"/>
  ${wheels}
</svg>`;
}
