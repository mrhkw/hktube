import { formatDate, formatDuration, formatViews, VideoRecord } from "@/lib/video";
import {
  Heart,
  Inbox,
  Maximize2,
  MessageCircle,
  MoreHorizontal,
  Play,
  Save,
  Share2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";

function formatCount(value: number): string {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1) + "M";
  if (value >= 1_000) return (value / 1_000).toFixed(value >= 10_000 ? 0 : 1) + "K";
  return String(value);
}

export function VideoCard({ video, compact = false }: { video: VideoRecord; compact?: boolean }) {
  const mediaRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [followed, setFollowed] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setMuted(true);
    setFollowed(false);
    setLiked(false);
    setSaved(false);
    setRatio(null);
    setProgress(0);
  }, [video.id]);

  const togglePlayback = async () => {
    const media = mediaRef.current;
    if (!media) return;
    if (media.paused) {
      try {
        await media.play();
      } catch {
        setPlaying(false);
      }
    } else {
      media.pause();
    }
  };

  const toggleMute = () => {
    const media = mediaRef.current;
    if (!media) return;
    const nextMuted = !media.muted;
    media.muted = nextMuted;
    setMuted(nextMuted);
  };

  const toggleFullscreen = async () => {
    const media = mediaRef.current;
    if (!media) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await media.requestFullscreen();
    } catch {
      // Fullscreen can be blocked by browser policy.
    }
  };

  const shareVideo = async () => {
    const url = new URL(`/watch/${video.id}`, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title: video.title, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // Native sharing may be cancelled or unavailable.
    }
  };

  return (
    <article className="group block min-w-0 overflow-hidden bg-white text-neutral-950 sm:rounded-2xl sm:shadow-sm sm:ring-1 sm:ring-black/5">
      <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
        <Link
          href={`/watch/${video.id}`}
          className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-violet-100 text-sm font-black text-violet-700"
          aria-label="Open creator video"
        >
          {video.channelAvatarUrl ? (
            <img src={video.channelAvatarUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
          ) : (
            video.channelName?.slice(0, 1).toUpperCase() || "H"
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate text-sm font-bold text-neutral-950">
              {video.channelName || "HkTube Creator"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setFollowed(value => !value)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${followed ? "bg-neutral-100 text-neutral-700" : "bg-violet-600 text-white hover:bg-violet-700"}`}
          aria-pressed={followed}
        >
          {followed ? "Following" : "Follow"}
        </button>

        <button type="button" className="grid size-9 shrink-0 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100" aria-label="More options">
          <MoreHorizontal className="size-5" />
        </button>
      </div>

      <div className="px-3 pb-2 sm:px-4">
        <Link href={`/watch/${video.id}`} className="block">
          <h3 className="line-clamp-2 text-[15px] font-bold leading-5 sm:text-base">{video.title}</h3>
        </Link>
      </div>

      <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: ratio ? String(ratio) : "16 / 9" }}>
        {video.thumbnailUrl && !playing && (
          <img src={video.thumbnailUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
        )}

        <video
          ref={mediaRef}
          src={video.videoUrl}
          poster={video.thumbnailUrl ?? undefined}
          playsInline
          preload="metadata"
          muted={muted}
          className="relative block size-full cursor-pointer bg-black object-contain"
          onLoadedMetadata={event => {
            const media = event.currentTarget;
            if (media.videoWidth > 0 && media.videoHeight > 0) setRatio(media.videoWidth / media.videoHeight);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={event => {
            const media = event.currentTarget;
            setProgress(media.duration > 0 ? (media.currentTime / media.duration) * 100 : 0);
          }}
          onClick={() => void togglePlayback()}
        />

        {!playing && (
          <button
            type="button"
            onClick={event => {
              event.preventDefault();
              void togglePlayback();
            }}
            className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white shadow-xl backdrop-blur-sm transition hover:scale-105 active:scale-95"
            aria-label="Play video"
          >
            <Play className="ml-1 size-6 fill-current" />
          </button>
        )}

        <div className="absolute bottom-3 right-3 flex gap-2">
          <button
            type="button"
            onClick={event => {
              event.preventDefault();
              toggleMute();
            }}
            className="grid size-10 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm"
            aria-label={muted ? "Unmute video" : "Mute video"}
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
          <button
            type="button"
            onClick={event => {
              event.preventDefault();
              void toggleFullscreen();
            }}
            className="grid size-10 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm"
            aria-label="Fullscreen video"
          >
            <Maximize2 className="size-5" />
          </button>
        </div>

        {progress > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-white/20">
            <div className="h-full bg-white" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        )}

        {video.durationSeconds > 0 && !playing && (
          <span className="absolute bottom-3 left-3 rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold tabular-nums text-white">
            {formatDuration(video.durationSeconds)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 border-b border-black/5 px-2 py-2">
        <button type="button" onClick={() => setLiked(value => !value)} className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition ${liked ? "text-violet-600" : "text-neutral-600 hover:bg-neutral-100"}`} aria-pressed={liked}>
          <Heart className={`size-5 ${liked ? "fill-current" : ""}`} />
          <span>{formatCount((video.likesCount ?? 0) + (liked ? 1 : 0))}</span>
        </button>

        <Link href={`/watch/${video.id}#comments`} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-neutral-600 hover:bg-neutral-100">
          <MessageCircle className="size-5" />
          <span>Comment</span>
        </Link>

        <button type="button" onClick={() => void shareVideo()} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-neutral-600 hover:bg-neutral-100">
          <Share2 className="size-5" />
          <span>Share</span>
        </button>

        <button type="button" onClick={() => setSaved(value => !value)} className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition ${saved ? "text-violet-600" : "text-neutral-600 hover:bg-neutral-100"}`} aria-pressed={saved}>
          <Save className={`size-5 ${saved ? "fill-current" : ""}`} />
          <span>Save</span>
        </button>

        <button type="button" className="grid min-h-11 min-w-11 place-items-center rounded-xl text-neutral-600 hover:bg-neutral-100" aria-label="More video actions">
          <MoreHorizontal className="size-5" />
        </button>
      </div>

      {!compact && (
        <div className="flex gap-3 px-3 py-3 sm:px-4">
          <Link href={`/watch/${video.id}`} className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-violet-100 text-xs font-black text-violet-700">
            {video.channelAvatarUrl ? <img src={video.channelAvatarUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" /> : (video.channelName?.slice(0, 1).toUpperCase() || "H")}
          </Link>
          <div className="min-w-0">
            <p className="text-sm font-bold text-neutral-900">{video.channelName || "HkTube Creator"}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{formatViews(video.viewCount)} views · {formatDate(video.uploadedAt)}</p>
            <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-neutral-700">{video.description || "Watch this video on HkTube."}</p>
          </div>
        </div>
      )}
    </article>
  );
}

export function EmptyVideos({
  title,
  copy,
  icon: Icon = Inbox,
}: {
  title: string;
  copy: string;
  icon?: typeof Inbox;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-16 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-black text-white">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-bold text-neutral-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-neutral-500">{copy}</p>
    </div>
  );
}
