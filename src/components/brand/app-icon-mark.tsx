import { cn } from "@/lib/utils";
import {
  BRAND_ICON_BODY_PATH,
  BRAND_ICON_FILL,
  BRAND_ICON_ACCENT,
  BRAND_ICON_VIEWBOX,
  BRAND_ICON_WHEELS,
  BRAND_ICON_WINDSHIELD_PATH,
} from "@/lib/brand-icon";

interface AppIconMarkProps {
  size?: number;
  className?: string;
}

export { BRAND_ICON_VIEWBOX };

export function AppIconMark({ size = 32, className }: AppIconMarkProps) {
  return (
    <svg
      viewBox={BRAND_ICON_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={cn("shrink-0 self-center", className)}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <rect width="64" height="64" rx="14" fill={BRAND_ICON_FILL} />
      <path fill="#FFFFFF" d={BRAND_ICON_BODY_PATH} />
      <path fill={BRAND_ICON_ACCENT} d={BRAND_ICON_WINDSHIELD_PATH} />
      {BRAND_ICON_WHEELS.map((wheel) => (
        <circle key={`${wheel.cx}-${wheel.cy}`} cx={wheel.cx} cy={wheel.cy} r={wheel.r} fill="#FFFFFF" />
      ))}
    </svg>
  );
}
