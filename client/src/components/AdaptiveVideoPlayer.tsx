import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { Settings2 } from "lucide-react";

type QualityLevel = { index: number; height: number; bitrate: number };

type AdaptiveVideoPlayerProps = {
  src: string;
  poster?: string | null;
  muxPlaybackId?: string | null;
  className?: string;
  onLoadedMetadata?: React.ReactEventHandler<HTMLVideoElement>;
  onLoadedData?: React.ReactEventHandler<HTMLVideoElement>;
  onPlay?: React.ReactEventHandler<HTMLVideoElement>;
  onTimeUpdate?: React.ReactEventHandler<HTMLVideoElement>;
  onEnded?: React.ReactEventHandler<HTMLVideoElement>;
  onError?: React.ReactEventHandler<HTMLVideoElement>;
  ref?: React.Ref<HTMLVideoElement>;
};

function qualityLabel(height: number) {
  if (height >= 4320) return "8K";
  if (height >= 2160) return "4K";
  if (height >= 1440) return "1440p";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  if (height >= 480) return "480p";
  return `${height}p`;
}

export function AdaptiveVideoPlayer({
  src,
  poster,
  muxPlaybackId,
  className,
  onLoadedMetadata,
  onLoadedData,
  onPlay,
  onTimeUpdate,
  onEnded,
  onError,
  ref,
}: AdaptiveVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [selected, setSelected] = useState("auto");
  const [menuOpen, setMenuOpen] = useState(false);
  const hlsUrl = muxPlaybackId
    ? `https://stream.mux.com/${encodeURIComponent(muxPlaybackId)}.m3u8`
    : null;
  const source = hlsUrl || src;

  const qualityOptions = useMemo(() => {
    const unique = new Map<number, QualityLevel>();
    for (const level of levels) {
      const current = unique.get(level.height);
      if (!current || level.bitrate > current.bitrate)
        unique.set(level.height, level);
    }
    return [...unique.values()].sort((a, b) => b.height - a.height);
  }, [levels]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    hlsRef.current?.destroy();
    hlsRef.current = null;
    setLevels([]);
    setSelected("auto");

    if (!hlsUrl || Hls.isSupported()) {
      if (hlsUrl && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          capLevelToPlayerSize: false,
        });
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLevels(
            hls.levels.map((level, index) => ({
              index,
              height: level.height,
              bitrate: level.bitrate,
            }))
          );
        });
        hlsRef.current = hls;
      } else {
        video.src = source;
      }
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
    } else {
      video.src = src;
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [hlsUrl, src, source]);

  function chooseQuality(value: string) {
    setSelected(value);
    setMenuOpen(false);
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = value === "auto" ? -1 : Number(value);
  }

  return (
    <div className="relative size-full">
      <video
        ref={node => {
          videoRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        src={source}
        poster={poster || undefined}
        controls
        playsInline
        preload="metadata"
        className={className}
        onLoadedMetadata={onLoadedMetadata}
        onLoadedData={onLoadedData}
        onPlay={onPlay}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onError={onError}
      />
      {qualityOptions.length > 0 && (
        <div className="absolute bottom-3 right-3 z-10">
          <button
            type="button"
            onClick={() => setMenuOpen(value => !value)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-black/75 px-2.5 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur hover:bg-black/90"
            aria-label="Select video quality"
          >
            <Settings2 className="size-3.5" />{" "}
            {selected === "auto"
              ? "Auto"
              : qualityLabel(
                  qualityOptions.find(level => String(level.index) === selected)
                    ?.height || 0
                )}
          </button>
          {menuOpen && (
            <div className="absolute bottom-10 right-0 min-w-28 overflow-hidden rounded-xl border border-white/10 bg-[#10131d]/95 p-1 text-xs text-white shadow-2xl backdrop-blur-xl">
              <button
                type="button"
                onClick={() => chooseQuality("auto")}
                className={`block w-full rounded-lg px-3 py-2 text-left hover:bg-white/10 ${selected === "auto" ? "text-cyan-200" : "text-slate-300"}`}
              >
                Auto
              </button>
              {qualityOptions.map(level => (
                <button
                  key={level.index}
                  type="button"
                  onClick={() => chooseQuality(String(level.index))}
                  className={`block w-full rounded-lg px-3 py-2 text-left hover:bg-white/10 ${selected === String(level.index) ? "text-cyan-200" : "text-slate-300"}`}
                >
                  {qualityLabel(level.height)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
