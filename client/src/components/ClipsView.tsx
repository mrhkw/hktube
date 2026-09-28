import React, { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
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
      className="flex min-w-[48px] flex-col items-center justify-center text-white transition-transform active:scale-90"
    >
      <span className="flex h-11 w-11 items-center justify-center">
        {children}
      </span>

      {count !== undefined && (
        <span className="mt-0.5 text-[12px] font-semibold leading-none drop-shadow-lg">
          <Count value={value} />
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

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;

        const index = Number(visible.target.getAttribute("data-index"));
        if (Number.isFinite(index)) {
          setActiveIndex(index);
        }
      },
      { root, threshold: [0.65, 0.8, 0.95] }
    );

    root.querySelectorAll<HTMLElement>("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [videos.length]);

  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([id, video]) => {
      if (!video) return;

      const index = videos.findIndex((item) => item.id === id);

      if (index === activeIndex) {
        video.currentTime = 0;
        video.muted = true;
        void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      } else {
        video.pause();
      }
    });
  }, [activeIndex, videos]);

  if (!videos || videos.length === 0) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-black text-white">
        No Clips Available
      </div>
    );
  }

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-black select-none">
      <div
        ref={containerRef}
        className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory bg-black [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {videos.map((video, index) => {
          const isActive = index === activeIndex;
          const isLiked = Boolean(liked[video.id]);
          const isSaved = Boolean(saved[video.id]);

          return (
            <section
              key={video.id}
              data-index={index}
              className="relative flex h-[100dvh] w-full snap-start snap-always items-center justify-center overflow-hidden bg-black"
            >
              <video
                ref={(element) => {
                  videoRefs.current[video.id] = element;
                }}
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

              {/* Gradients */}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-black/50 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-64 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

              {/* Header Navigation */}
              <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-4 text-white">
                <div className="w-10" />
                <div className="flex items-center gap-5 text-[17px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setFollowing(true)}
                    className={following ? "border-b-2 border-white pb-1" : "text-white/65"}
                  >
                    Following
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowing(false)}
                    className={!following ? "border-b-2 border-white pb-1" : "text-white/65"}
                  >
                    For You
                  </button>
                </div>
                <button type="button" aria-label="Search" className="flex h-10 w-10 items-center justify-center">
                  <Search className="h-7 w-7" strokeWidth={2} />
                </button>
              </header>

              {/* Right Sidebar Icons */}
              <aside className="absolute bottom-20 right-3 z-30 flex flex-col items-center gap-4 text-white">
                <Action
                  active={isLiked}
                  count={video.likes}
                  label="Like"
                  onClick={() => setLiked((c) => ({ ...c, [video.id]: !c[video.id] }))}
                >
                  <Heart className={isLiked ? "h-8 w-8 fill-red-500 text-red-500" : "h-8 w-8"} strokeWidth={2} />
                </Action>

                <Action count={video.comments} label="Comments">
                  <MessageCircle className="h-8 w-8" strokeWidth={2} />
                </Action>

                <Action
                  active={isSaved}
                  count={video.favorites}
                  label="Favorite"
                  onClick={() => setSaved((c) => ({ ...c, [video.id]: !c[video.id] }))}
                >
                  <Star className={isSaved ? "h-8 w-8 fill-yellow-400 text-yellow-400" : "h-8 w-8"} strokeWidth={2} />
                </Action>

                <Action count={video.shares} label="Share">
                  <Send className="h-8 w-8" fill="currentColor" strokeWidth={1.8} />
                </Action>

                <button type="button" aria-label="More options" className="flex h-11 w-11 items-center justify-center text-white">
                  <MoreHorizontal className="h-8 w-8" />
                </button>

                <button type="button" aria-label="Original sound" className="mt-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/80 bg-black/60 shadow-xl">
                  <Music2 className="h-5 w-5 animate-spin" />
                </button>
              </aside>

              {/* Bottom Video Details */}
              <div className="absolute bottom-6 left-4 right-20 z-30 flex flex-col gap-2 text-white">
                <div className="flex items-center gap-2">
                  <img
                    src={video.avatar || "/hktube-icon.svg"}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full border border-white/40 object-cover"
                  />
                  <span className="max-w-[45vw] truncate text-sm font-bold drop-shadow-lg">{video.username}</span>
                  {video.verified && <BadgeCheck className="h-5 w-5 shrink-0 fill-sky-500 text-white" />}
                  <button type="button" className="ml-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-black">
                    Follow
                  </button>
                </div>

                <p className="max-w-[90%] text-sm leading-5 drop-shadow-lg">{video.caption}</p>

                {video.hashtags && video.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-x-2 text-sm font-semibold">
                    {video.hashtags.map((tag) => (
                      <span key={tag}>#{tag.replace(/^#/, "")}</span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div className="flex min-w-0 items-center gap-1.5 text-xs">
                    <Music2 className="h-4 w-4 shrink-0" />
                    <span className="truncate drop-shadow-lg">{video.soundTitle}</span>
                  </div>
                  <button type="button" className="shrink-0 rounded-full bg-white/20 px-3 py-1 text-[10px] font-semibold backdrop-blur-md">
                    Use sound
                  </button>
                </div>
              </div>

              {!playing && isActive && (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                  <div className="rounded-full bg-black/45 p-4 backdrop-blur-sm">
                    <span className="block text-2xl text-white">▶</span>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
      }
