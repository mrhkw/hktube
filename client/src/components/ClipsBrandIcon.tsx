type ClipsBrandIconProps = {
  className?: string;
  alt?: string;
};

/** Inline vector mark: transparent, crisp at every size, and never opens or downloads an image. */
export function ClipsBrandIcon({
  className = "size-6",
  alt = "HkTube Clips",
}: ClipsBrandIconProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label={alt}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
    >
      <defs>
        <linearGradient id="hktube-clips-gradient" x1="7" y1="5" x2="41" y2="43" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" />
          <stop offset="0.55" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#D946EF" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="13" fill="url(#hktube-clips-gradient)" />
      <rect x="12.5" y="14.5" width="23" height="19" rx="4.5" stroke="white" strokeWidth="2.6" />
      <path d="M21 19.5L29 24L21 28.5V19.5Z" fill="white" />
      <path d="M9 10.5L12 7.5M36 40.5L39 37.5" stroke="#FDE68A" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
