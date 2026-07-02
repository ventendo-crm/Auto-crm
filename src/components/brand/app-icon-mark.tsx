interface AppIconMarkProps {
  size?: number;
  className?: string;
}

export function AppIconMark({ size = 32, className }: AppIconMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect width="64" height="64" rx="14" fill="#FF7F5C" />
      <path
        fill="#FFFFFF"
        d="M14 36.5c0-1.7 1.3-3 3-3h2.2l3.2-5.8c.5-.9 1.4-1.4 2.4-1.4h17.2c1 0 1.9.5 2.4 1.4l3.2 5.8H47c1.7 0 3 1.3 3 3v5H14v-5zm4.5-9.2 2.6-4.8h21.8l2.6 4.8H18.5z"
      />
      <circle cx="22" cy="39.5" r="3" fill="#FFFFFF" />
      <circle cx="42" cy="39.5" r="3" fill="#FFFFFF" />
      <path fill="#FFFFFF" fillOpacity="0.85" d="M26 24h12l1.8 3.5H24.2L26 24z" />
    </svg>
  );
}
