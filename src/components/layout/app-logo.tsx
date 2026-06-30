import { AppIconMark } from "@/components/brand/app-icon-mark";

interface AppLogoProps {
  size?: number;
  className?: string;
}

export function AppLogo({ size = 32, className }: AppLogoProps) {
  return <AppIconMark size={size} className={className ?? "shrink-0"} />;
}
