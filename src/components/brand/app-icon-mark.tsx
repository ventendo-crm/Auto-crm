import { cn } from "@/lib/utils";
import { getBrandIconUrl } from "@/lib/brand-icon";

interface AppIconMarkProps {
  size?: number;
  className?: string;
}

export function AppIconMark({ size = 32, className }: AppIconMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- user-provided raster logo, used as-is
    <img
      src={getBrandIconUrl()}
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0 self-center", className)}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
      draggable={false}
      aria-hidden
    />
  );
}
