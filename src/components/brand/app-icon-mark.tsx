interface AppIconMarkProps {
  size?: number;
  className?: string;
}

/** Drive Classic — единый знак бренда для сайта и Android */
export const BRAND_ICON_VIEWBOX = "0 0 64 64";

export function AppIconMark({ size = 32, className }: AppIconMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={BRAND_ICON_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect width="64" height="64" rx="14" fill="#FF7F5C" />
      <path
        fill="#FFFFFF"
        d="M13.5 37c0-1.9 1.5-3.4 3.4-3.4h2.4l3.4-6.2c.5-1 1.5-1.6 2.6-1.6h18.2c1.1 0 2.1.6 2.6 1.6l3.4 6.2h2.4c1.9 0 3.4 1.5 3.4 3.4V42H13.5V37zm5-10.4 2.8-5h22.4l2.8 5H18.5z"
      />
      <path fill="#E85F3A" d="M24.5 22.5h15l2.2 4.2H22.3l2.2-4.2z" />
      <circle cx="21.5" cy="40" r="3.2" fill="#FFFFFF" />
      <circle cx="42.5" cy="40" r="3.2" fill="#FFFFFF" />
    </svg>
  );
}
