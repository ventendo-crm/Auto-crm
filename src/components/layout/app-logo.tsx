import Image from "next/image";

interface AppLogoProps {
  size?: number;
  className?: string;
}

export function AppLogo({ size = 32, className }: AppLogoProps) {
  return (
    <Image
      src="/icon-192.png"
      alt="Auto-CRM"
      width={size}
      height={size}
      className={className ?? "shrink-0 rounded-lg"}
      priority
    />
  );
}
