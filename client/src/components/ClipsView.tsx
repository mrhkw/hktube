import React, { useEffect, useRef, useState } from "react";
import { ClipsBrandIcon } from "@/components/ClipsBrandIcon";
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Search,
  Send,
  Star,
} from "lucide-react";

export type Clip = {
  id: string;
  url: string;
  avatar: string | null;
  username: string;
  verified?: boolean;
  caption: string;
  hashtags?: string[];
  soundTitle: string;
  likes: number;
  comments: number;
  favorites: number;
  shares: number;
};

type TikTokFeedProps = {
  videos: Clip[];
};

function Count({ value }: { value: number }) {
  if (value >= 1_000_000) return <>{(value / 1_000_000).toFixed(1)}M</>;
  if (value >= 1_000) return <>{(value / 1_000).toFixed(1)}K</>;
  return <>{value}</>;
}

function Action({
  children,
  count,
  label,
  active = false,
  onClick,
}: {
  children: React.ReactNode;
  count?: number;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex min-w-[44px] flex-col items-center justify-center text-white transition-transform active:scale-90"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/20 backdrop-blur-sm">
        {children}
      </span>
      {count !== undefined && (
        <span className="mt-0.5 text-[12px] font-semibold leading-none drop-shadow-lg">
          <Count value={count} />
        </span>
      )}
    </button>
  );
}

export default function ClipsView({ videos = [] }: TikTokFeedProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [following, setFollowing] = useState(false);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [playing, setPlaying] = useState(true);
  const [followedCreators, setFollowedCreators] = useState<Record<string, boolean>>({});
  const [optionsFor, setOptionsFor] = useState<string | null>(null);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = Number(visible.target.getAttribute("data-index"));
        if (Number.isFinite(index)) setActiveIndex(index);
      },
      { root, threshold: [0.65, 0.8, 0.95] }
    );
    root.querySelectorAll<HTMLElement>("[data-index]").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [videos.length]);

  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([id, video]) => {
      if (!video) return;
      const index = videos.findIndex(item => item.id === id);
      if (index === activeIndex) {
        video.muted = true;
        void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      } else {
        video.pause();
      }
    });
  }, [activeIndex, videos]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOptionsFor(null);
        setCommentsFor(null);
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const next = Math.max(0, Math.min(videos.length - 1, activeIndex + (event.key === "ArrowDown" ? 1 : -1)));
        const target = containerRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`);
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, videos.length]);

  if (!videos.length) {
    return (
      <div className="hktube-clips-page flex h-[100dvh] w-full items-center justify-center bg-black text-white">
        <div className="text-center">
          <ClipsBrandIcon className="mx-auto mb-4 size-14" />
          <p className="text-lg font-bold">No Clips available yet</p>
          <p className="mt-2 text-sm text-white/60">New Clips will appear here.</p>
        </div>
      </div>
    );
  }

  const activeVideo = videos.find(video => video.id === commentsFor || video.id === optionsFor);

  return (
    <main className="hktube-clips-page relative h-[100dvh] w-full overflow-hidden bg-[#05060a] text-white">
      <div
        ref={containerRef}
        className="h-[100dvh] w-full snap-y snap-mandatory overflow-y-scroll bg-[#05060a] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {videos.map((video, index) => {
          const isActive = index === activeIndex;
          const isLiked = Boolean(liked[video.id]);
          const isSaved = Boolean(saved[video.id]);
          const isFollowed = Boolean(followedCreators[video.username]);
          return (
            <section
              key={video.id}
              data-index={index}
              className="relative flex h-[100dvh] w-full snap-start snap-always items-center justify-center overflow-hidden bg-[#05060a] px-0 md:px-5 lg:px-8"
            >
              <div className="relative h-full w-full overflow-hidden bg-black md:h-[calc(100dvh-28px)] md:aspect-[9/16] md:w-auto md:max-w-[calc(100vw-40px)] md:rounded-2xl md:border md:border-white/10 md:shadow-[0_20px_90px_rgba(0,0,0,.55)]">
                <video
                  ref={element => { videoRefs.current[video.id] = element; }}
                  src={video.url}
                  playsInline
                  muted
                  loop
                  preload={isActive ? "auto" : "metadata"}
                  className="h-full w-full object-cover"
                  onClick={() => {
                    const element = videoRefs.current[video.id];
                    if (!element) return;
                    if (element.paused) {
                      void element.play();
                      setPlaying(true);
                    } else {
                      element.pause();
                      setPlaying(false);
                    }
                  }}
                />

                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-black/65 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-64 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />

                <header className="absolute inset-x-0 top-0 z-30 grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 pt-[max(14px,env(safe-area-inset-top))] text-white md:px-4">
                  <a href="/" aria-label="HkTube home" className="flex min-w-0 items-center gap-1.5 rounded-lg bg-black/25 px-2 py-1.5 backdrop-blur-sm">
                    <ClipsBrandIcon className="size-7 shrink-0" />
                    <span className="whitespace-nowrap text-sm font-black tracking-tight">HkTube <span className="text-violet-300">Clips</span></span>
                  </a>
                  <div className="flex items-center justify-center gap-2 text-[13px] font-semibold sm:gap-3 sm:text-[15px]">
                    <button type="button" onClick={() => setFollowing(true)} className={following ? "border-b-2 border-white pb-1" : "text-white/65"}>Following</button>
                    <button type="button" onClick={() => setFollowing(false)} className={!following ? "border-b-2 border-white pb-1" : "text-white/65"}>For You</button>
                  </div>
                  <button type="button" aria-label="Search Clips" onClick={() => window.location.assign("/search?q=clips")} className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/25 backdrop-blur-sm">
                    <Search className="h-6 w-6" strokeWidth={2} />
                  </button>
                </header>

                <aside className="absolute bottom-24 right-2 z-30 flex flex-col items-center gap-3 text-white sm:gap-4 md:right-3">
                  <Action active={isLiked} count={video.likes + (isLiked ? 1 : 0)} label={isLiked ? "Unlike Clip" : "Like Clip"} onClick={() => setLiked(current => ({ ...current, [video.id]: !current[video.id] }))}>
                    <Heart className={isLiked ? "h-7 w-7 fill-fuchsia-500 text-fuchsia-400" : "h-7 w-7"} strokeWidth={2.1} />
                  </Action>
                  <Action count={video.comments} label="Open comments" onClick={() => setCommentsFor(video.id)}>
                    <MessageCircle className="h-7 w-7" strokeWidth={2.1} />
                  </Action>
                  <Action active={isSaved} count={video.favorites + (isSaved ? 1 : 0)} label={isSaved ? "Remove from saved" : "Save Clip"} onClick={() => setSaved(current => ({ ...current, [video.id]: !current[video.id] }))}>
                    <Star className={isSaved ? "h-7 w-7 fill-amber-300 text-amber-300" : "h-7 w-7"} strokeWidth={2.1} />
                  </Action>
                  <Action count={video.shares} label="Share Clip" onClick={() => {
                    const url = `${window.location.origin}/clips`;
                    if (navigator.share) void navigator.share({ title: "HkTube Clip", text: video.caption, url }).catch(() => undefined);
                    else if (navigator.clipboard) void navigator.clipboard.writeText(url);
                  }}>
                    <Send className="h-7 w-7" strokeWidth={2.1} />
                  </Action>
                  <button type="button" aria-label="More Clip options" onClick={() => setOptionsFor(video.id)} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-sm">
                    <MoreHorizontal className="h-7 w-7" />
                  </button>
                  <div aria-label="Clip sound" className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/80 bg-black/60 shadow-xl">
                    <Music2 className="h-4 w-4" />
                  </div>
                </aside>

                <div className="absolute bottom-5 left-3 right-[66px] z-30 flex flex-col gap-2 text-white md:left-4 md:right-[72px] md:bottom-6">
                  <div className="flex items-center gap-2">
                    <img src={video.avatar || "/brand/hktube-new-mark-transparent.png"} alt="" className="h-9 w-9 shrink-0 rounded-full border border-white/50 object-cover md:h-10 md:w-10" />
                    <span className="max-w-[42vw] truncate text-sm font-bold drop-shadow-lg md:max-w-[220px]">{video.username}</span>
                    {video.verified && <span aria-label="Verified creator" className="grid size-4 place-items-center rounded-full bg-sky-500 text-[10px] font-black">✓</span>}
                    <button type="button" onClick={() => setFollowedCreators(current => ({ ...current, [video.username]: !current[video.username] }))} className={isFollowed ? "ml-1 rounded-full border border-white/50 px-3 py-1 text-xs font-bold text-white" : "ml-1 rounded-full bg-fuchsia-600 px-3 py-1 text-xs font-bold text-white hover:bg-fuchsia-500"}>
                      {isFollowed ? "Following" : "Follow"}
                    </button>
                  </div>
                  <p className="line-clamp-3 max-w-[95%] text-sm leading-5 drop-shadow-lg">{video.caption}</p>
                  {video.hashtags?.length ? <div className="flex flex-wrap gap-x-2 text-sm font-semibold">{video.hashtags.map(tag => <span key={tag}>#{tag.replace(/^#/, "")}</span>)}</div> : null}
                  <div className="flex items-center gap-2">
                    <div className="flex min-w-0 items-center gap-1.5 text-xs">
                      <Music2 className="h-4 w-4 shrink-0" />
                      <span className="truncate drop-shadow-lg">{video.soundTitle}</span>
                    </div>
                    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("hktube-open-create"))} className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold">Use sound</button>
                  </div>
                </div>

                {!playing && isActive && <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"><div className="rounded-full bg-black/45 p-4 backdrop-blur-sm"><span className="block text-2xl text-white">▶</span></div></div>}
              </div>
            </section>
          );
        })}
      </div>

      {(optionsFor || commentsFor) && (
        <div className="absolute inset-0 z-[80] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm md:items-center" onClick={() => { setOptionsFor(null); setCommentsFor(null); }}>
          <div role="dialog" aria-modal="true" aria-label={commentsFor ? "Clip comments" : "Clip options"} className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111522] p-5 text-white shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">{commentsFor ? "Comments" : "Clip options"}</h2>
              <button type="button" onClick={() => { setOptionsFor(null); setCommentsFor(null); }} className="rounded-full px-3 py-1 text-white/70 hover:bg-white/10">Close</button>
            </div>
            {commentsFor ? (
              <div className="space-y-3">
                <p className="text-sm text-white/70">Comments for this Clip will appear here when available.</p>
                <a href="/auth" className="inline-flex rounded-full bg-violet-600 px-4 py-2 text-sm font-bold">Sign in to join the conversation</a>
              </div>
            ) : (
              <div className="grid gap-2">
                <button type="button" onClick={() => { const url = `${window.location.origin}/clips`; if (navigator.clipboard) void navigator.clipboard.writeText(url); setOptionsFor(null); }} className="rounded-xl px-3 py-3 text-left text-sm hover:bg-white/10">Copy Clip link</button>
                <button type="button" onClick={() => { setSaved(current => ({ ...current, [optionsFor!]: true })); setOptionsFor(null); }} className="rounded-xl px-3 py-3 text-left text-sm hover:bg-white/10">Save to Library</button>
                <button type="button" onClick={() => setOptionsFor(null)} className="rounded-xl px-3 py-3 text-left text-sm hover:bg-white/10">Not interested</button>
                <button type="button" onClick={() => { setOptionsFor(null); window.location.assign("/help"); }} className="rounded-xl px-3 py-3 text-left text-sm text-rose-300 hover:bg-white/10">Report Clip</button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
