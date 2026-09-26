import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Flag,
  Heart,
  MessageCircle,
  MoreVertical,
  Pause,
  Play,
  Search,
  Send,
  Share2,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import {
  listPublicSupabaseShorts,
  type SupabaseVideo,
} from "@/lib/supabaseVideos";
import {
  addVideoComment,
  listVideoComments,
  recordVideoView,
  reportVideo,
  toggleChannelSubscription,
  toggleVideoLike,
  toggleVideoSave,
} from "@/lib/supabaseEngagement";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type Channel = {
  id: string;
  handle: string;
  name: string;
  avatar_url: string | null;
  subscriber_count: number;
  verification_status: string;
};
type Comment = {
  id: string;
  body: string;
  created_at: string;
  profiles?: { username?: string | null; avatar_url?: string | null }[] | null;
};
const compact = (n: number) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.max(0, n));
const ago = (v: string) => {
  const m = Math.floor(Math.max(0, Date.now() - new Date(v).getTime()) / 60000);
  return m < 1
    ? "now"
    : m < 60
      ? m + "m"
      : m < 1440
        ? Math.floor(m / 60) + "h"
        : Math.floor(m / 1440) + "d";
};
function rank(
  v: SupabaseVideo,
  s: {
    watched: Set<string>;
    liked: Set<string>;
    saved: Set<string>;
    followed: Set<string>;
    hidden: Set<string>;
  }
) {
  if (
    s.hidden.has(v.id) ||
    ["removed", "blocked", "copyright_blocked"].includes(
      String(v.moderationStatus || "")
    )
  )
    return -1e9;
  const age = Math.max(
    1,
    (Date.now() - new Date(v.createdAt).getTime()) / 3600000
  );
  return (
    Math.max(0, 72 - age) * 0.45 +
    Math.log1p(v.viewCount) * 1.2 +
    Math.log1p(v.likesCount) * 2 +
    (s.watched.has(v.id) ? 3 : 0) +
    (s.liked.has(v.id) ? 4 : 0) +
    (s.saved.has(v.id) ? 3 : 0) +
    (s.followed.has(v.channelId) ? 6 : 0) +
    (v.moderationStatus === "approved"
      ? 2
      : v.moderationStatus === "under_review"
        ? -2
        : 0)
  );
}
function ClipsLogo({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="clips-logo-gradient" x1="4" y1="4" x2="44" y2="44">
          <stop stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <rect
        x="3"
        y="3"
        width="42"
        height="42"
        rx="13"
        fill="url(#clips-logo-gradient)"
      />
      <path d="M20 15.5 34 24 20 32.5V15.5Z" fill="white" />
      <path
        d="M11 16.5a7 7 0 0 1 7-7h8M11 31.5a7 7 0 0 0 7 7h8"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function ClipsPage() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<SupabaseVideo[]>([]);
  const [channels, setChannels] = useState<Record<string, Channel>>({});
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<"for-you" | "following">("for-you");
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [liked, setLiked] = useState(new Set<string>());
  const [saved, setSaved] = useState(new Set<string>());
  const [followed, setFollowed] = useState(new Set<string>());
  const [hidden, setHidden] = useState(new Set<string>());
  const [more, setMore] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [touchY, setTouchY] = useState<number | null>(null);
  const [lastTap, setLastTap] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [comment, setComment] = useState("");
  const media = useRef<HTMLVideoElement | null>(null);
  const watched = useRef(new Set<string>());
  const [mediaError, setMediaError] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [heartBurst, setHeartBurst] = useState(false);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const data = await listPublicSupabaseShorts(80);
        if (!live) return;
        setVideos(data);
        const ids = [...new Set(data.map(v => v.channelId).filter(Boolean))];
        if (ids.length) {
          const { data: rows } = await supabase
            .from("channels")
            .select(
              "id,handle,name,avatar_url,subscriber_count,verification_status"
            )
            .in("id", ids);
          if (live)
            setChannels(
              Object.fromEntries(
                (rows ?? []).map(r => [String(r.id), r as Channel])
              )
            );
        }
      } catch (e) {
        if (live)
          toast.error(e instanceof Error ? e.message : "Clips could not load");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [f, l, s] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("channel_id")
          .eq("subscriber_id", user.id),
        supabase.from("likes").select("video_id").eq("user_id", user.id),
        supabase.from("saves").select("video_id").eq("user_id", user.id),
      ]);
      setFollowed(new Set((f.data ?? []).map(r => String(r.channel_id))));
      setLiked(new Set((l.data ?? []).map(r => String(r.video_id))));
      setSaved(new Set((s.data ?? []).map(r => String(r.video_id))));
    })();
  }, [user]);
  const ranked = useMemo(() => {
    const s = { watched: watched.current, liked, saved, followed, hidden };
    const list = videos
      .map(v => ({ v, s: rank(v, s) }))
      .filter(x => x.s > -1e8)
      .sort((a, b) => b.s - a.s)
      .map(x => x.v);
    return tab === "following"
      ? list.filter(v => followed.has(v.channelId))
      : list;
  }, [videos, liked, saved, followed, hidden, tab]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? ranked.filter(v =>
          (v.title + " " + (v.description || "") + " " + v.tags.join(" "))
            .toLowerCase()
            .includes(q)
        )
      : ranked;
  }, [ranked, search]);
  const current = visible[active];
  const channel = current ? channels[current.channelId] : undefined;
  useEffect(() => {
    if (active >= visible.length) setActive(Math.max(0, visible.length - 1));
  }, [active, visible.length]);
  useEffect(() => {
    const v = media.current;
    if (!v || !current) return;
    setMediaError(false);
    setMediaReady(false);
    v.muted = true;
    v.load();
    if (playing) void v.play().catch(() => setPlaying(false));
    else v.pause();
    watched.current.add(current.id);
    void recordVideoView(current.id, 0).catch(() => undefined);
    return () => v.pause();
  }, [current?.id, playing]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive(i => Math.min(i + 1, visible.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(i => Math.max(i - 1, 0));
      }
      if (e.key === " ") {
        e.preventDefault();
        setPlaying(p => !p);
      }
    };
    addEventListener("keydown", fn);
    return () => removeEventListener("keydown", fn);
  }, [visible.length]);
  async function auth() {
    if (!user) {
      startLogin();
      return false;
    }
    return true;
  }
  async function like() {
    if (!current || !(await auth())) return;
    try {
      setHeartBurst(true);
      window.setTimeout(() => setHeartBurst(false), 620);
      const r = await toggleVideoLike(current.id);
      setLiked(p => {
        const n = new Set(p);
        r.liked ? n.add(current.id) : n.delete(current.id);
        return n;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Like failed");
    }
  }
  async function save() {
    if (!current || !(await auth())) return;
    try {
      const r = await toggleVideoSave(current.id);
      setSaved(p => {
        const n = new Set(p);
        r ? n.add(current.id) : n.delete(current.id);
        return n;
      });
      toast.success(r ? "Saved to Library" : "Removed from Library");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }
  async function follow() {
    if (!current || !(await auth())) return;
    try {
      const r = await toggleChannelSubscription(current.channelId);
      setFollowed(p => {
        const n = new Set(p);
        r.subscribed ? n.add(current.channelId) : n.delete(current.channelId);
        return n;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Follow failed");
    }
  }
  async function share() {
    if (!current) return;
    const url = window.location.origin + "/watch/" + current.id;
    try {
      if (navigator.share) await navigator.share({ title: current.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Clip link copied");
      }
    } catch (e) {
      if ((e as DOMException).name !== "AbortError")
        toast.error("Share failed");
    }
  }
  async function openComments() {
    if (!current) return;
    try {
      setComments(await listVideoComments(current.id));
      setCommentsOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Comments could not load");
    }
  }
  async function postComment() {
    if (!current || !(await auth()) || !comment.trim()) return;
    try {
      await addVideoComment(current.id, comment.trim());
      setComment("");
      setComments(await listVideoComments(current.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Comment failed");
    }
  }
  async function report(reason: string) {
    if (!current || !(await auth())) return;
    try {
      await reportVideo(current.id, reason);
      toast.success("Report submitted for review");
      setMore(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Report failed");
    }
  }
  function notInterested() {
    if (!current) return;
    setHidden(p => new Set(p).add(current.id));
    setMore(false);
    setActive(i => Math.min(i + 1, Math.max(visible.length - 1, 0)));
    toast.success("Recommendation adjusted");
  }
  function retryMedia() {
    const v = media.current;
    if (!v) return;
    setMediaError(false);
    setMediaReady(false);
    v.load();
    void v.play().catch(() => setPlaying(false));
  }
  return (
    <HkTubeShell immersive minimalHeader>
      <div className="hktube-clips-page relative h-[100dvh] overflow-hidden bg-black text-white">
        <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pb-10 pt-[max(12px,env(safe-area-inset-top))] bg-gradient-to-b from-black/75 to-transparent">
          <Link href="/" className="grid size-9 place-items-center rounded-full bg-black/30 text-2xl leading-none text-white backdrop-blur" aria-label="Back to HkTube">‹</Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(v => !v)}
              className="grid size-10 place-items-center rounded-full bg-black/35 backdrop-blur"
              aria-label="Search Clips"
            >
              <Search className="size-5" />
            </button>
          </div>
        </div>
        <div className="absolute left-1/2 top-3 z-40 flex -translate-x-1/2 rounded-full bg-black/35 p-1 backdrop-blur">
          <button
            onClick={() => {
              setTab("for-you");
              setActive(0);
            }}
            className={
              "rounded-full px-4 py-2 text-xs font-black " +
              (tab === "for-you" ? "bg-white text-black" : "text-white")
            }
          >
            For You
          </button>
          <button
            onClick={() => {
              setTab("following");
              setActive(0);
            }}
            className={
              "rounded-full px-4 py-2 text-xs font-black " +
              (tab === "following" ? "bg-white text-black" : "text-white")
            }
          >
            Following
          </button>
        </div>
        {searchOpen && (
          <div className="absolute left-4 right-4 top-16 z-50 flex items-center rounded-2xl border border-white/10 bg-black/85 p-2 backdrop-blur-xl">
            <Search className="ml-2 size-4 text-slate-400" />
            <input
              autoFocus
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setActive(0);
              }}
              placeholder="Search Clips"
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
            />
            <button
              onClick={() => {
                setSearch("");
                setSearchOpen(false);
              }}
              aria-label="Close search"
            >
              <X className="size-5" />
            </button>
          </div>
        )}
        {loading ? (
          <div className="grid h-full place-items-center">
            <div className="text-center">
              <ClipsLogo className="mx-auto size-14 animate-pulse" />
              <p className="mt-3 text-sm text-slate-400">Loading Clips…</p>
            </div>
          </div>
        ) : !current ? (
          <div className="grid h-full place-items-center p-6 text-center">
            <ClipsLogo className="mx-auto size-16" />
            <h2 className="mt-5 text-xl font-black">
              {tab === "following"
                ? "No Clips from followed creators"
                : "No Clips available"}
            </h2>
            <p className="mt-2 max-w-sm text-sm text-slate-400">
              Publish a vertical Clip or follow creators to build the feed.
            </p>
            <Link
              href="/upload?category=shorts"
              className="mt-5 inline-flex rounded-full bg-violet-500 px-5 py-3 text-sm font-black"
            >
              Create a Clip
            </Link>
          </div>
        ) : (
          <div
            className="hktube-clips-stage h-full"
            onTouchStart={e => setTouchY(e.touches[0]?.clientY ?? null)}
            onTouchEnd={e => {
              if (touchY == null) return;
              const d = (e.changedTouches[0]?.clientY ?? touchY) - touchY;
              if (Math.abs(d) > 55)
                setActive(i =>
                  d < 0
                    ? Math.min(i + 1, visible.length - 1)
                    : Math.max(i - 1, 0)
                );
              setTouchY(null);
            }}
          >
            <div className="hktube-clips-viewport relative mx-auto h-full w-full max-w-[620px] bg-black">
              {current.thumbnailUrl && (
                <img
                  src={current.thumbnailUrl}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                  decoding="async"
                />
              )}
              <video
                ref={media}
                src={current.videoUrl}
                poster={current.thumbnailUrl ?? undefined}
                muted
                autoPlay
                playsInline
                loop
                preload="auto"
                className={
                  (mediaReady ? "opacity-100" : "opacity-0") +
                  " relative z-10 size-full min-h-0 object-cover bg-black transition-opacity duration-300 sm:rounded-3xl"
                }
                onPlay={() => {
                  setMediaError(false);
                  setMediaReady(true);
                  setPlaying(true);
                }}
                onCanPlay={() => setMediaReady(true)}
                onLoadedData={() => setMediaReady(true)}
                onPause={() => setPlaying(false)}
                onError={() => setMediaError(true)}
                onClick={() => {
                  const now = Date.now();
                  if (now - lastTap < 320) {
                    setHeartBurst(true);
                    window.setTimeout(() => setHeartBurst(false), 620);
                    void like();
                  } else {
                    setPlaying(p => !p);
                  }
                  setLastTap(now);
                }}
                onTimeUpdate={e => {
                  const v = e.currentTarget;
                  if (
                    v.duration &&
                    v.currentTime >= Math.min(3, v.duration * 0.25)
                  )
                    void recordVideoView(current.id, v.currentTime).catch(
                      () => undefined
                    );
                }}
              />
              {mediaError && (
                <div className="absolute inset-0 z-30 grid place-items-center bg-black/90 p-6 text-center">
                  <div>
                    <p className="font-black">
                      This Clip cannot play on this device
                    </p>
                    <p className="mt-1 text-xs text-white/60">
                      Try again, or open it in the full video player.
                    </p>
                    <button
                      type="button"
                      onClick={retryMedia}
                      className="mt-3 inline-flex rounded-full bg-violet-500 px-4 py-2 text-xs font-black text-white"
                    >
                      Try again
                    </button>
                    <Link
                      href={"/watch/" + current.id}
                      className="ml-2 inline-flex rounded-full bg-white px-4 py-2 text-xs font-black text-black"
                    >
                      Open video
                    </Link>
                  </div>
                </div>
              )}
              {heartBurst && (
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 text-6xl text-rose-500 hktube-heart-burst">
                  ♥
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/25" />
              {!playing && (
                <button
                  onClick={() => setPlaying(true)}
                  className="absolute left-1/2 top-1/2 z-20 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/50 backdrop-blur"
                  aria-label="Play Clip"
                >
                  <Play className="ml-1 size-7 fill-current" />
                </button>
              )}
              <div className="absolute bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] left-4 right-20 z-20 sm:bottom-24 sm:left-6">
                <span className="mb-2 inline-flex rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-black text-white/80 backdrop-blur">
                  {active + 1} / {visible.length}
                </span>
                <div className="flex items-center gap-3">
                  <Link
                    href={
                      channel
                        ? "/channel/" + channel.handle
                        : "/watch/" + current.id
                    }
                    className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-violet-500 font-black"
                  >
                    {channel?.avatar_url ? (
                      <img
                        src={channel.avatar_url}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      "HK"
                    )}
                  </Link>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="truncate font-black">
                        {channel ? "@" + channel.handle : "HkTube Creator"}
                      </span>
                      {channel?.verification_status === "verified" && (
                        <span className="grid size-4 place-items-center rounded-full bg-sky-400 text-black">
                          <Check className="size-3" />
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => void follow()}
                      className={
                        "mt-1 rounded-full border px-3 py-1 text-[11px] font-black " +
                        (followed.has(current.channelId)
                          ? "border-white/25 bg-white/10"
                          : "border-fuchsia-300/50 bg-fuchsia-500/80")
                      }
                    >
                      {followed.has(current.channelId) ? "Following" : "Follow"}
                    </button>
                  </div>
                </div>
                <h1 className="mt-3 line-clamp-2 text-base font-black sm:text-lg">
                  {current.title}
                </h1>
                {current.description && (
                  <p className="mt-1 line-clamp-3 text-sm text-slate-200">
                    {current.description}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {current.tags.slice(0, 7).map(t => (
                    <span key={t} className="text-xs font-bold text-white/80">
                      #{t.replace(/^#/, "")}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-300">
                  {compact(current.viewCount)} views · {ago(current.createdAt)}
                </p>
              </div>
              <div className="absolute bottom-[max(5rem,calc(env(safe-area-inset-bottom)+4rem))] right-3 z-30 flex flex-col items-center gap-3 sm:right-5">
                <Action
                  icon={Heart}
                  label={compact(
                    current.likesCount + (liked.has(current.id) ? 1 : 0)
                  )}
                  active={liked.has(current.id)}
                  onClick={() => void like()}
                />
                <Action
                  icon={MessageCircle}
                  label="Comment"
                  onClick={() => void openComments()}
                />
                <Action
                  icon={Bookmark}
                  label="Save"
                  active={saved.has(current.id)}
                  onClick={() => void save()}
                />
                <Action
                  icon={Share2}
                  label="Share"
                  onClick={() => void share()}
                />
                <Action
                  icon={MoreVertical}
                  label="More"
                  onClick={() => setMore(v => !v)}
                />
              </div>
              <div className="absolute left-0 right-0 top-0 z-20 h-1 bg-white/10">
                <div
                  className="h-full bg-violet-400 transition-[width] duration-150"
                  style={{
                    width: `${Math.min(100, ((active + 1) / Math.max(visible.length, 1)) * 100)}%`,
                  }}
                />
              </div>
              <div className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-2 sm:flex">
                <button
                  onClick={() => setActive(i => Math.max(i - 1, 0))}
                  disabled={!active}
                  className="grid size-9 place-items-center rounded-full bg-black/35 disabled:opacity-30"
                  aria-label="Previous Clip"
                >
                  <ChevronUp className="size-5" />
                </button>
                <button
                  onClick={() =>
                    setActive(i => Math.min(i + 1, visible.length - 1))
                  }
                  disabled={active >= visible.length - 1}
                  className="grid size-9 place-items-center rounded-full bg-black/35 disabled:opacity-30"
                  aria-label="Next Clip"
                >
                  <ChevronDown className="size-5" />
                </button>
              </div>
              {more && (
                <div className="absolute bottom-44 right-16 z-40 w-56 rounded-2xl border border-white/10 bg-[#10131b]/95 p-2 text-sm shadow-2xl backdrop-blur-xl">
                  <button
                    onClick={notInterested}
                    className="w-full rounded-xl px-3 py-2.5 text-left hover:bg-white/10"
                  >
                    Not interested
                  </button>
                  <button
                    onClick={() => void report("Spam or misleading")}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-white/10"
                  >
                    <Flag className="size-4" />
                    Report Clip
                  </button>
                  <button
                    onClick={() => void report("Copyright concern")}
                    className="w-full rounded-xl px-3 py-2.5 text-left hover:bg-white/10"
                  >
                    Copyright concern
                  </button>
                  <button
                    onClick={() => void share()}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-white/10"
                  >
                    <Send className="size-4" />
                    Copy/share link
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {commentsOpen && (
        <div
          className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
          onClick={() => setCommentsOpen(false)}
        >
          <section
            className="absolute bottom-0 left-0 right-0 mx-auto flex max-h-[75dvh] w-full max-w-2xl flex-col rounded-t-3xl border border-white/10 bg-[#10131b] p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-black">Comments</h2>
              <button
                onClick={() => setCommentsOpen(false)}
                aria-label="Close comments"
              >
                <X />
              </button>
            </div>
            <div className="mt-4 flex-1 overflow-y-auto space-y-4">
              {comments.length ? (
                comments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-500 font-black">
                      {c.profiles?.[0]?.username?.[0]?.toUpperCase() ?? "H"}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400">
                        @{c.profiles?.[0]?.username ?? "user"}
                      </p>
                      <p className="mt-1 text-sm text-white">{c.body}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-10 text-center text-sm text-slate-500">
                  No comments yet. Be the first.
                </p>
              )}
            </div>
            <div className="mt-4 flex gap-2 border-t border-white/10 pt-3">
              <input
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") void postComment();
                }}
                placeholder="Add a comment…"
                className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
              />
              <button
                onClick={() => void postComment()}
                className="grid size-12 place-items-center rounded-full bg-violet-500"
                aria-label="Post comment"
              >
                <Send className="size-5" />
              </button>
            </div>
          </section>
        </div>
      )}
    </HkTubeShell>
  );
}
function Action({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Heart;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="clips-action flex min-h-12 min-w-12 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold leading-4 text-white drop-shadow-md"
      aria-label={label}
    >
      <span
        className={
          "grid size-12 place-items-center rounded-full backdrop-blur-md " +
          (active ? "clips-action-active bg-fuchsia-500/80" : "bg-black/35")
        }
      >
        <Icon
          className={
            "size-6 stroke-[1.8] " + (active && Icon === Heart ? "fill-current" : "")
          }
        />
      </span>
      <span>{label}</span>
    </button>
  );
}
