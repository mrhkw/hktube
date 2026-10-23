type ClipsBrandIconProps = {
  className?: string;
  alt?: string;
};

/**
 * The supplied Clips mark is intentionally used only for Clips surfaces.
 * object-contain preserves the original artwork and avoids CSS blur from SVG scaling.
 */
export function ClipsBrandIcon({
  className = "size-6",
  alt = "HkTube Clips",
}: ClipsBrandIconProps) {
  return (
    <img
      src="/hktube-clips-icon.jpg"
      alt={alt}
      className={`block object-contain ${className}`}
      draggable={false}
    />
  );
}
