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
        d="M15 40c0-1.5 1.2-2.7 2.7-2.7h2.1l2.8-5c.4-.8 1.2-1.3 2.1-1.3h17.6c.9 0 1.7.5 2.1 1.3l2.8 5H47.3c1.5 0 2.7 1.2 2.7 2.7v3.3H15V40zm4.8-9.6 2.4-4.3h20.4l2.4 4.3H19.8z"
      />
      <path fill="#E85F3A" d="M25 29.5h14l1.8 3.3H23.2l1.8-3.3z" />
      <circle cx="22" cy="42" r="2.9" fill="#FFFFFF" />
      <circle cx="42" cy="42" r="2.9" fill="#FFFFFF" />
    </svg>
  );
}
