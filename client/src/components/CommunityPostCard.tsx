import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * The image carousel a community post shows when it carries more than one image.
 *
 * The layout follows the YouTube app: a horizontal snap strip with dots and, for
 * pointer users, arrows. One image renders plainly, without the furniture.
 */
export function CommunityPostCarousel({
  paths,
  urlFor,
  title,
}: {
  paths: string[];
  urlFor: (path: string | null | undefined) => string | null;
  title: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const urls = paths.map(path => urlFor(path)).filter((url): url is string => Boolean(url));

  if (urls.length === 0) return null;

  if (urls.length === 1) {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        <img src={urls[0]} alt={title} className="max-h-[420px] w-full object-contain" loading="lazy" />
      </div>
    );
  }

  function goTo(next: number) {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(urls.length - 1, next));
    track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
    setIndex(clamped);
  }

  return (
    <div className="relative mt-4">
      <div
        ref={trackRef}
        onScroll={event => {
          const track = event.currentTarget;
          if (track.clientWidth === 0) return;
          setIndex(Math.round(track.scrollLeft / track.clientWidth));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl border border-white/10 bg-black/40"
        style={{ scrollbarWidth: "none" }}
      >
        {urls.map((url, position) => (
          <img
            key={url}
            src={url}
            alt={`${title} — image ${position + 1} of ${urls.length}`}
            className="max-h-[420px] w-full shrink-0 snap-center object-contain"
            loading="lazy"
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => goTo(index - 1)}
        disabled={index === 0}
        aria-label="Previous image"
        className="absolute left-2 top-1/2 hidden size-8 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white disabled:opacity-0 md:grid"
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => goTo(index + 1)}
        disabled={index === urls.length - 1}
        aria-label="Next image"
        className="absolute right-2 top-1/2 hidden size-8 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white disabled:opacity-0 md:grid"
      >
        <ChevronRight className="size-4" />
      </button>

      <div className="mt-2 flex justify-center gap-1.5">
        {urls.map((url, position) => (
          <button
            key={`dot-${url}`}
            type="button"
            onClick={() => goTo(position)}
            aria-label={`Go to image ${position + 1}`}
            className={
              "size-1.5 rounded-full transition " + (position === index ? "bg-white" : "bg-white/35 hover:bg-white/60")
            }
          />
        ))}
      </div>
    </div>
  );
}

export default CommunityPostCarousel;
