"use client";

import { AppIconMark } from "@/components/brand/app-icon-mark";
import { useCompanyAppearance } from "@/hooks/use-company-appearance";
import { cn } from "@/lib/utils";

interface AppLogoProps {
  size?: number;
  className?: string;
}

export function AppLogo({ size = 32, className }: AppLogoProps) {
  const { logoSrc } = useCompanyAppearance();

  if (logoSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- company-uploaded logo
      <img
        src={logoSrc}
        alt=""
        width={size}
        height={size}
        className={cn("shrink-0 self-center object-contain", className ?? "")}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
        draggable={false}
        aria-hidden
      />
    );
  }

  return <AppIconMark size={size} className={className ?? "shrink-0 self-center"} />;
}
