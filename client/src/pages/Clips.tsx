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
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { type SupabaseVideo } from "@/lib/supabaseVideos";
import { rankPublicVideos, recordDiscoveryEvent } from "@/lib/supabaseDiscovery";
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
    <main
      className="fixed inset-0 z-[100] h-[100dvh] w-full overflow-hidden bg-black text-white"
      onTouchStart={e => setTouchY(e.touches[0]?.clientY ?? null)}
      onTouchEnd={e => {
        if (touchY == null) return;
        const d = (e.changedTouches[0]?.clientY ?? touchY) - touchY;
        if (Math.abs(d) > 55) {
          setActive(i =>
            d < 0
              ? Math.min(i + 1, visible.length - 1)
              : Math.max(i - 1, 0)
          );
        }
        setTouchY(null);
      }}
      onWheel={e => {
        if (Math.abs(e.deltaY) < 30) return;
        setActive(i =>
          e.deltaY > 0
            ? Math.min(i + 1, visible.length - 1)
            : Math.max(i - 1, 0)
        );
      }}
    >
      {loading ? (
        <div className="grid h-full place-items-center bg-black">
          <ClipsLogo className="size-14 animate-pulse" />
        </div>
      ) : !current ? (
        <div className="grid h-full place-items-center bg-black p-6 text-center">
          <div>
            <ClipsLogo className="mx-auto size-16" />
            <h2 className="mt-5 text-xl font-black">No Clips available</h2>
            <p className="mt-2 text-sm text-white/60">
              Publish a vertical Clip to build the feed.
            </p>
            <Link
              href="/clips/create"
              className="mt-5 inline-flex rounded-full bg-white px-5 py-3 text-sm font-black text-black"
            >
              Create a Clip
            </Link>
          </div>
        </div>
      ) : (
        <section className="relative h-full w-full bg-black">
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
              " absolute inset-0 z-10 size-full object-cover bg-black transition-opacity duration-300"
            }
            onPlay={() => {
              setMediaError(false);
              setMediaReady(true);
              setPlaying(true);
              void recordDiscoveryEvent({
                eventType: "play_start",
                objectType: "short",
                objectId: current.id,
              }).catch(() => undefined);
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
              ) {
                void recordVideoView(current.id, v.currentTime).catch(
                  () => undefined
                );
              }
              if (v.duration > 0) {
                const ratio = v.currentTime / v.duration;
                const eventType =
                  ratio >= 0.9
                    ? "watch_90_percent"
                    : ratio >= 0.75
                      ? "watch_75_percent"
                      : ratio >= 0.5
                        ? "watch_50_percent"
                        : ratio >= 0.25
                          ? "watch_25_percent"
                          : null;
                if (eventType) {
                  void recordDiscoveryEvent({
                    eventType,
                    objectType: "short",
                    objectId: current.id,
                    watchSeconds: v.currentTime,
                    positionSeconds: v.currentTime,
                  }).catch(() => undefined);
                }
              }
            }}
          />

          <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-black/30 via-transparent to-black/90" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[48%] bg-gradient-to-t from-black/95 via-black/35 to-transparent" />

          <div className="absolute inset-x-0 top-0 z-40 pt-[max(8px,env(safe-area-inset-top))]">
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-9">
                <button
                  type="button"
                  onClick={() => {
                    setTab("following");
                    setActive(0);
                  }}
                  className={
                    "relative py-3 text-[16px] font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,.8)] " +
                    (tab === "following" ? "text-white" : "text-white/65")
                  }
                >
                  Following
                  {tab === "following" && (
                    <span className="absolute bottom-1 left-1/2 h-0.5 w-7 -translate-x-1/2 rounded-full bg-white" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab("for-you");
                    setActive(0);
                  }}
                  className={
                    "relative py-3 text-[16px] font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,.8)] " +
                    (tab === "for-you" ? "text-white" : "text-white/65")
                  }
                >
                  For You
                  {tab === "for-you" && (
                    <span className="absolute bottom-1 left-1/2 h-0.5 w-7 -translate-x-1/2 rounded-full bg-white" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSearchOpen(v => !v)}
              className="absolute right-4 top-1 grid size-11 place-items-center text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.8)] transition active:scale-90"
              aria-label="Search Clips"
            >
              <Search className="size-8 stroke-[2]" />
            </button>
          </div>

          {searchOpen && (
            <div className="absolute left-4 right-4 top-[max(58px,calc(env(safe-area-inset-top)+52px))] z-[60] flex items-center rounded-full border border-white/15 bg-black/75 px-3 py-1.5 backdrop-blur-xl">
              <Search className="ml-2 size-5 text-white/60" />
              <input
                autoFocus
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setActive(0);
                }}
                placeholder="Search Clips"
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-white/45"
              />
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSearchOpen(false);
                }}
                className="grid size-9 place-items-center rounded-full text-white"
                aria-label="Close search"
              >
                <X className="size-5" />
              </button>
            </div>
          )}

          {heartBurst && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 text-8xl text-white drop-shadow-[0_12px_35px_rgba(0,0,0,.55)] hktube-heart-burst">
              ♥
            </div>
          )}

          {!playing && (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="absolute left-1/2 top-1/2 z-40 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md"
              aria-label="Play Clip"
            >
              <Play className="ml-1 size-7 fill-current" />
            </button>
          )}

          {mediaError && (
            <div className="absolute inset-0 z-[70] grid place-items-center bg-black/90 p-6 text-center">
              <div>
                <p className="font-black">This Clip cannot play on this device</p>
                <button
                  type="button"
                  onClick={retryMedia}
                  className="mt-4 rounded-full bg-white px-5 py-2.5 text-sm font-black text-black"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          <div className="absolute bottom-[max(22px,env(safe-area-inset-bottom))] right-3 z-40 flex w-[62px] flex-col items-center gap-4">
            <button
              type="button"
              onClick={() => void follow()}
              className="grid size-12 place-items-center rounded-full border-2 border-white bg-black/25 shadow-2xl backdrop-blur-sm transition active:scale-90"
              aria-label="Follow creator"
            >
              {channel?.avatar_url ? (
                <img
                  src={channel.avatar_url}
                  alt=""
                  className="size-full rounded-full object-cover"
                />
              ) : (
                <span className="text-xs font-black">HK</span>
              )}
            </button>

            <Action
              icon={Heart}
              label={compact(current.likesCount + (liked.has(current.id) ? 1 : 0))}
              active={liked.has(current.id)}
              onClick={() => void like()}
            />
            <Action
              icon={MessageCircle}
              label={comments.length ? compact(comments.length) : "Comment"}
              onClick={() => void openComments()}
            />
            <Action
              icon={Star}
              label={saved.has(current.id) ? "Saved" : "Save"}
              active={saved.has(current.id)}
              onClick={() => void save()}
            />
            <Action
              icon={Send}
              label="Share"
              onClick={() => void share()}
              filled
            />
            <Action
              icon={MoreVertical}
              label="More"
              onClick={() => setMore(v => !v)}
            />
          </div>

          <div className="absolute bottom-[max(25px,env(safe-area-inset-bottom))] left-4 z-40 max-w-[calc(100%-92px)] text-white">
            <div className="flex items-center gap-2.5">
              <Link
                href={
                  channel
                    ? "/channel/" + channel.handle
                    : "/watch/" + current.id
                }
                className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-black shadow-xl"
              >
                {channel?.avatar_url ? (
                  <img
                    src={channel.avatar_url}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-black">HK</span>
                )}
              </Link>

              <Link
                href={
                  channel
                    ? "/channel/" + channel.handle
                    : "/watch/" + current.id
                }
                className="truncate text-[17px] font-extrabold drop-shadow-[0_2px_8px_rgba(0,0,0,.9)]"
              >
                @{channel?.handle || "hktube"}
              </Link>

              {channel?.verification_status === "verified" && (
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white text-sky-500 shadow">
                  <Check className="size-3.5 stroke-[3]" />
                </span>
              )}

              <button
                type="button"
                onClick={() => void follow()}
                className={
                  "rounded-full px-4 py-1.5 text-sm font-bold transition active:scale-95 " +
                  (followed.has(current.channelId)
                    ? "bg-white/20 text-white backdrop-blur-md"
                    : "bg-white text-black")
                }
              >
                {followed.has(current.channelId) ? "Following" : "Follow"}
              </button>
            </div>

            <h1 className="mt-3 text-[17px] font-extrabold drop-shadow-[0_2px_8px_rgba(0,0,0,.9)]">
              {current.title}
            </h1>

            {current.description && (
              <p className="mt-1 max-w-[520px] line-clamp-2 text-[14px] font-medium leading-5 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.9)]">
                {current.description}
              </p>
            )}

            <div className="mt-1 flex flex-wrap gap-x-2 text-[14px] font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.9)]">
              {current.tags.slice(0, 5).map(t => (
                <span key={t}>#{t.replace(/^#/, "")}</span>
              ))}
            </div>

            <button
              type="button"
              onClick={() => toast.info("Original sound is from this Clip.")}
              className="mt-3 flex max-w-full items-center gap-2 text-[14px] font-semibold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.9)]"
            >
              <span className="text-lg leading-none">♫</span>
              <span className="truncate">
                Original Sound · {channel?.name || "HkTube Creator"}
              </span>
            </button>
          </div>

          <div className="absolute bottom-[max(22px,env(safe-area-inset-bottom))] left-1/2 z-40 hidden -translate-x-1/2 sm:block">
            <span className="rounded-full bg-black/35 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
              {active + 1} / {visible.length}
            </span>
          </div>

          {more && (
            <div className="absolute bottom-[max(100px,calc(env(safe-area-inset-bottom)+82px))] right-16 z-[80] w-56 rounded-2xl border border-white/10 bg-black/85 p-2 text-sm text-white shadow-2xl backdrop-blur-xl">
              <button
                type="button"
                onClick={notInterested}
                className="w-full rounded-xl px-3 py-2.5 text-left hover:bg-white/10"
              >
                Not interested
              </button>
              <button
                type="button"
                onClick={() => void report("Spam or misleading")}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-white/10"
              >
                <Flag className="size-4" />
                Report Clip
              </button>
              <button
                type="button"
                onClick={() => void report("Copyright concern")}
                className="w-full rounded-xl px-3 py-2.5 text-left hover:bg-white/10"
              >
                Copyright concern
              </button>
              <button
                type="button"
                onClick={() => void share()}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-white/10"
              >
                <Send className="size-4" />
                Copy/share link
              </button>
            </div>
          )}
        </section>
      )}

      {commentsOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm"
          onClick={() => setCommentsOpen(false)}
        >
          <section
            className="absolute bottom-0 left-0 right-0 mx-auto flex max-h-[75dvh] w-full max-w-2xl flex-col rounded-t-3xl border border-white/10 bg-[#10131b] p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-black">Comments</h2>
              <button
                type="button"
                onClick={() => setCommentsOpen(false)}
                aria-label="Close comments"
              >
                <X />
              </button>
            </div>
            <div className="mt-4 flex-1 space-y-4 overflow-y-auto">
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
                type="button"
                onClick={() => void postComment()}
                className="grid size-12 place-items-center rounded-full bg-white text-black"
                aria-label="Post comment"
              >
                <Send className="size-5" />
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
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
