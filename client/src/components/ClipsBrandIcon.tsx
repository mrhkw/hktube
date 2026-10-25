type ClipsBrandIconProps = {
  className?: string;
  alt?: string;
};

/** Transparent inline vector mark; it is UI, not a downloadable image asset. */
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
        <linearGradient id="hktube-clips-gradient" x1="10" y1="7" x2="38" y2="41" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" />
          <stop offset="0.55" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#D946EF" />
        </linearGradient>
      </defs>
      <rect x="7" y="10" width="34" height="28" rx="8" stroke="url(#hktube-clips-gradient)" strokeWidth="3.5" />
      <path d="M21 17.5L31 24L21 30.5V17.5Z" fill="url(#hktube-clips-gradient)" />
      <path d="M12 5.5L15 8.5M33 39.5L36 42.5" stroke="#FDE68A" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
