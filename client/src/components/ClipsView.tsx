import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Link, type RouteComponentProps } from "wouter";
import {
  BadgeCheck,
  Bookmark,
  EyeOff,
  Flag,
  Heart,
  Link2,
  Loader2,
  MessageCircle,
  MoreVertical,
  Pause,
  Play,
  RefreshCw,
  Share2,
  UserRound,
  UserRoundX,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { startLogin } from "@/const";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  getVideoEngagement,
  reportVideo,
  recordVideoView,
  toggleChannelSubscription,
  toggleVideoLike,
  toggleVideoSave,
} from "@/lib/supabaseEngagement";
import {
  recordDiscoveryEvent,
  setRecommendationFeedback,
} from "@/lib/supabaseDiscovery";
import type { RankedVideo } from "@/lib/supabaseDiscovery";

export type Clip = RankedVideo;

type Creator = {
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  verified: boolean;
};

type CreatorState = Record<string, Creator | null>;
type BoolState = Record<string, boolean>;
type NumberState = Record<string, number>;

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.max(0, Math.floor(value)));
}

function normalizeHashtags(video: Clip) {
  return video.tags
    .filter(tag => tag.trim().toLowerCase() !== "shorts")
    .map(tag => tag.replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

function getClipTitle(video: Clip) {
  return video.title.trim() || "HkTube Clip";
}

function ActionButton({
  label,
  count,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  count?: number;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className="flex min-w-12 flex-col items-center justify-center gap-1 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.7)] transition-transform active:scale-90 disabled:opacity-60"
    >
      <span className="grid size-11 place-items-center rounded-full bg-black/20 backdrop-blur-[2px]">
        {children}
      </span>
      {count !== undefined && (
        <span className="text-xs font-bold leading-none">{formatCount(count)}</span>
      )}
    </button>
  );
}

function CreatorAvatar({ creator }: { creator: Creator | null }) {
  if (creator?.avatarUrl) {
    return (
      <img
        src={creator.avatarUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="size-11 rounded-full border border-white/70 object-cover"
      />
    );
  }
  return (
    <span
      className="grid size-11 place-items-center rounded-full border border-white/50 bg-black/50"
      aria-hidden="true"
    >
      <UserRound className="size-6 text-white" />
    </span>
  );
}

type ClipsViewProps = Partial<RouteComponentProps<Record<string, string | undefined>>> & { videos?: Clip[] };

export default function ClipsView({ videos = [] }: ClipsViewProps) {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const mutedRef = useRef(true);
  const viewRecordedRef = useRef<Set<string>>(new Set());
  const tapRef = useRef<{ id: string; time: number } | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [videoErrors, setVideoErrors] = useState<Record<string, string>>({});
  const [liked, setLiked] = useState<BoolState>({});
  const [likeCounts, setLikeCounts] = useState<NumberState>({});
  const [saved, setSaved] = useState<BoolState>({});
  const [followed, setFollowed] = useState<BoolState>({});
  const [commentCounts, setCommentCounts] = useState<NumberState>({});
  const [busy, setBusy] = useState<BoolState>({});
  const [creatorState, setCreatorState] = useState<CreatorState>({});
  const [menus, setMenus] = useState<BoolState>({});
  const [heartAnimation, setHeartAnimation] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
    Object.values(videoRefs.current).forEach(video => {
      if (video) video.muted = muted;
    });
  }, [muted]);

  useEffect(() => {
    let cancelled = false;
    if (!videos.length) return;

    const channelIds = [...new Set(videos.map(video => video.channelId).filter(Boolean))];
    const creatorIds = [...new Set(videos.map(video => video.creatorId).filter(Boolean))];

    void Promise.all([
      channelIds.length
        ? supabase
            .from("channels")
            .select("id,handle,name,avatar_url,verification_status")
            .in("id", channelIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      creatorIds.length
        ? supabase
            .from("profiles")
            .select("id,username,display_name,avatar_url,is_verified")
            .in("id", creatorIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ])
      .then(([channelsResult, profilesResult]) => {
        if (cancelled) return;
        const channels = new Map(
          (channelsResult.data ?? []).map(row => [String(row.id), row]),
        );
        const profiles = new Map(
          (profilesResult.data ?? []).map(row => [String(row.id), row]),
        );

        const nextCreators: CreatorState = {};
        videos.forEach(video => {
          const channel = channels.get(video.channelId);
          const profile = profiles.get(video.creatorId);
          const name =
            String(channel?.name ?? "").trim() ||
            String(profile?.display_name ?? "").trim() ||
            String(profile?.username ?? "").trim();
          nextCreators[video.id] = {
            name: name || "HkTube Creator",
            handle:
              typeof channel?.handle === "string" && channel.handle.trim()
                ? channel.handle.trim()
                : null,
            avatarUrl:
              typeof channel?.avatar_url === "string"
                ? channel.avatar_url
                : typeof profile?.avatar_url === "string"
                  ? profile.avatar_url
                  : null,
            verified:
              channel?.verification_status === "verified" ||
              profile?.is_verified === true,
          };
        });
        setCreatorState(nextCreators);
      })
      .catch(error => {
        if (!cancelled) {
          setInlineError(
            error instanceof Error
              ? error.message
              : "Creator information could not be loaded.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [videos]);

  useEffect(() => {
    if (!videos.length) return;
    setLikeCounts(current => {
      const next = { ...current };
      videos.forEach(video => {
        if (next[video.id] === undefined) next[video.id] = video.likesCount;
      });
      return next;
    });
    setCommentCounts(current => {
      const next = { ...current };
      videos.forEach(video => {
        if (next[video.id] === undefined) next[video.id] = 0;
      });
      return next;
    });
  }, [videos]);

  const loadEngagement = useCallback(
    async (video: Clip) => {
      try {
        const state = await getVideoEngagement(video.id, video.channelId);
        setLiked(current => ({ ...current, [video.id]: state.liked }));
        setSaved(current => ({ ...current, [video.id]: state.saved }));
        setFollowed(current => ({ ...current, [video.id]: state.subscribed }));
        setLikeCounts(current => ({ ...current, [video.id]: state.likeCount }));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Clip engagement could not be loaded.",
        );
      }
    },
    [],
  );

  const loadCommentsCount = useCallback(async (videoId: string) => {
    try {
      const { count, error } = await supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("video_id", videoId)
        .eq("moderation_status", "approved");
      if (error) throw error;
      setCommentCounts(current => ({ ...current, [videoId]: count ?? 0 }));
    } catch {
      // The comments screen remains the source of truth if this lightweight count query is unavailable.
    }
  }, []);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !videos.length) return;

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.index);
        if (!Number.isFinite(index)) return;
        setActiveIndex(index);
      },
      { root, threshold: [0.6, 0.75, 0.9] },
    );

    root.querySelectorAll<HTMLElement>("[data-clip-index]").forEach(element =>
      observer.observe(element),
    );
    return () => observer.disconnect();
  }, [videos.length]);

  useEffect(() => {
    if (!videos.length) return;
    const activeVideo = videos[activeIndex];
    if (!activeVideo) return;

    void loadEngagement(activeVideo);
    void loadCommentsCount(activeVideo.id);

    Object.entries(videoRefs.current).forEach(([id, element]) => {
      if (!element) return;
      if (id !== activeVideo.id) {
        element.pause();
        element.muted = mutedRef.current;
      }
    });

    const element = videoRefs.current[activeVideo.id];
    if (!element || !activeVideo.videoUrl) return;

    element.muted = mutedRef.current;
    element.currentTime = 0;
    setLoading(current => ({ ...current, [activeVideo.id]: true }));
    setVideoErrors(current => {
      const next = { ...current };
      delete next[activeVideo.id];
      return next;
    });

    void element
      .play()
      .then(() => {
        setPlaying(current => ({ ...current, [activeVideo.id]: true }));
      })
      .catch(() => {
        setPlaying(current => ({ ...current, [activeVideo.id]: false }));
      });
  }, [activeIndex, loadCommentsCount, loadEngagement, videos]);

  const markView = useCallback(
    (video: Clip, currentTime: number) => {
      if (viewRecordedRef.current.has(video.id)) return;
      viewRecordedRef.current.add(video.id);
      void recordVideoView(video.id, currentTime).catch(error => {
        viewRecordedRef.current.delete(video.id);
        toast.error(
          error instanceof Error ? error.message : "View could not be recorded.",
        );
      });
      void recordDiscoveryEvent({
        eventType: "play_start",
        objectType: "short",
        objectId: video.id,
      }).catch(() => undefined);
    },
    [],
  );

  const togglePlayback = useCallback((video: Clip) => {
    const element = videoRefs.current[video.id];
    if (!element) return;
    if (element.paused) {
      void element
        .play()
        .then(() => setPlaying(current => ({ ...current, [video.id]: true })))
        .catch(error => {
          setPlaying(current => ({ ...current, [video.id]: false }));
          toast.error(
            error instanceof Error
              ? error.message
              : "This clip could not start playing.",
          );
        });
    } else {
      element.pause();
      setPlaying(current => ({ ...current, [video.id]: false }));
    }
  }, []);

  const likeVideo = useCallback(
    async (video: Clip, doubleTap = false) => {
      if (!user) {
        startLogin();
        return false;
      }
      if (busy[video.id]) return false;

      const previousLiked = Boolean(liked[video.id]);
      const previousCount = likeCounts[video.id] ?? video.likesCount;
      const optimisticLiked = !previousLiked;
      setBusy(current => ({ ...current, [video.id]: true }));
      setLiked(current => ({ ...current, [video.id]: optimisticLiked }));
      setLikeCounts(current => ({
        ...current,
        [video.id]: Math.max(0, previousCount + (optimisticLiked ? 1 : -1)),
      }));

      try {
        const result = await toggleVideoLike(video.id);
        setLiked(current => ({ ...current, [video.id]: result.liked }));
        setLikeCounts(current => ({ ...current, [video.id]: Number(result.count) }));
        void recordDiscoveryEvent({
          eventType: result.liked ? "like" : "unlike",
          objectType: "short",
          objectId: video.id,
        }).catch(() => undefined);
        if (doubleTap && result.liked) {
          setHeartAnimation(video.id);
          window.setTimeout(
            () => setHeartAnimation(current => (current === video.id ? null : current)),
            700,
          );
        }
        return result.liked;
      } catch (error) {
        setLiked(current => ({ ...current, [video.id]: previousLiked }));
        setLikeCounts(current => ({ ...current, [video.id]: previousCount }));
        toast.error(
          error instanceof Error ? error.message : "Could not update like.",
        );
        return false;
      } finally {
        setBusy(current => ({ ...current, [video.id]: false }));
      }
    },
    [busy, likeCounts, liked, user],
  );

  const handleVideoPointer = useCallback(
    (event: PointerEvent<HTMLVideoElement>, video: Clip) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const now = Date.now();
      const previous = tapRef.current;
      if (previous?.id === video.id && now - previous.time < 280) {
        tapRef.current = null;
        void likeVideo(video, true);
        return;
      }
      tapRef.current = { id: video.id, time: now };
      window.setTimeout(() => {
        if (tapRef.current?.id === video.id && tapRef.current.time === now) {
          tapRef.current = null;
          togglePlayback(video);
        }
      }, 290);
    },
    [likeVideo, togglePlayback],
  );

  const handleVideoKeyDown = useCallback(
    (event: KeyboardEvent<HTMLVideoElement>, video: Clip) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        togglePlayback(video);
      }
    },
    [togglePlayback],
  );

  const follow = useCallback(
    async (video: Clip) => {
      if (!user) {
        startLogin();
        return;
      }
      if (busy[video.id]) return;

      const previous = Boolean(followed[video.id]);
      setBusy(current => ({ ...current, [video.id]: true }));
      setFollowed(current => ({ ...current, [video.id]: !previous }));
      try {
        const result = await toggleChannelSubscription(video.channelId);
        setFollowed(current => ({ ...current, [video.id]: result.subscribed }));
        void recordDiscoveryEvent({
          eventType: result.subscribed ? "follow" : "unfollow",
          objectType: "channel",
          objectId: video.channelId,
        }).catch(() => undefined);
      } catch (error) {
        setFollowed(current => ({ ...current, [video.id]: previous }));
        toast.error(
          error instanceof Error ? error.message : "Could not update follow.",
        );
      } finally {
        setBusy(current => ({ ...current, [video.id]: false }));
      }
    },
    [busy, followed, user],
  );

  const save = useCallback(
    async (video: Clip) => {
      if (!user) {
        startLogin();
        return;
      }
      if (busy[video.id]) return;
      const previous = Boolean(saved[video.id]);
      setBusy(current => ({ ...current, [video.id]: true }));
      setSaved(current => ({ ...current, [video.id]: !previous }));
      try {
        const result = await toggleVideoSave(video.id);
        setSaved(current => ({ ...current, [video.id]: result }));
        toast.success(result ? "Saved to your library." : "Removed from your library.");
      } catch (error) {
        setSaved(current => ({ ...current, [video.id]: previous }));
        toast.error(
          error instanceof Error ? error.message : "Could not update saved clips.",
        );
      } finally {
        setBusy(current => ({ ...current, [video.id]: false }));
      }
    },
    [busy, saved, user],
  );

  const share = useCallback(async (video: Clip) => {
    const url = new URL(`/watch/${video.id}`, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title: getClipTitle(video), url });
        toast.success("Share sheet opened.");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareFeedback(video.id);
        toast.success("Link copied.");
        window.setTimeout(
          () => setShareFeedback(current => (current === video.id ? null : current)),
          1800,
        );
      } else {
        throw new Error("Sharing is not supported by this browser.");
      }
      void recordDiscoveryEvent({
        eventType: "share",
        objectType: "short",
        objectId: video.id,
      }).catch(() => undefined);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Could not share this clip.");
    }
  }, []);

  const report = useCallback(
    async (video: Clip) => {
      if (!user) {
        startLogin();
        return;
      }
      try {
        await reportVideo(video.id, "policy_violation", "Reported from Clips.");
        setMenus(current => ({ ...current, [video.id]: false }));
        toast.success("Report sent to moderation.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not report this clip.");
      }
    },
    [user],
  );

  const feedback = useCallback(
    async (
      video: Clip,
      type: "not_interested" | "hide_creator" | "less_like_this",
    ) => {
      if (!user) {
        startLogin();
        return;
      }
      try {
        await setRecommendationFeedback(
          video.id,
          type,
          video.category || video.tags[0] || null,
        );
        setMenus(current => ({ ...current, [video.id]: false }));
        toast.success("Recommendation preference saved.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not update recommendations.",
        );
      }
    },
    [user],
  );

  const retryVideo = useCallback((video: Clip) => {
    const element = videoRefs.current[video.id];
    if (!element) return;
    setVideoErrors(current => {
      const next = { ...current };
      delete next[video.id];
      return next;
    });
    setLoading(current => ({ ...current, [video.id]: true }));
    element.load();
    if (video.id === videos[activeIndex]?.id) {
      void element
        .play()
        .then(() => setPlaying(current => ({ ...current, [video.id]: true })))
        .catch(() => setPlaying(current => ({ ...current, [video.id]: false })));
    }
  }, [activeIndex, videos]);

  const empty = useMemo(() => videos.length === 0, [videos.length]);

  if (empty) {
    return (
      <section className="grid min-h-[280px] place-items-center bg-black px-6 text-center text-white" aria-label="Clips">
        <div>
          <Play className="mx-auto size-9 text-white/60" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-bold">No Clips available</h2>
          <p className="mt-1 text-sm text-white/60">Published vertical videos will appear here.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative w-full bg-black text-white"
      aria-label="HkTube Clips"
    >
      <div
        ref={containerRef}
        className="mx-auto h-[100dvh] w-full max-w-[520px] overflow-y-auto overscroll-contain bg-black snap-y snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:h-[min(100dvh,925px)]"
      >
        {videos.map((video, index) => {
          const creator = creatorState[video.id] ?? null;
          const isActive = index === activeIndex;
          const isLiked = Boolean(liked[video.id]);
          const isFollowed = Boolean(followed[video.id]);
          const isSaved = Boolean(saved[video.id]);
          const isPlaying = Boolean(playing[video.id]);
          const videoError = videoErrors[video.id];
          const isLoading = Boolean(loading[video.id]);
          const hashtags = normalizeHashtags(video);
          const comments = commentCounts[video.id] ?? 0;
          const count = likeCounts[video.id] ?? video.likesCount;
          const creatorHref = creator?.handle ? `/channel/${creator.handle}` : null;
          const menuOpen = Boolean(menus[video.id]);

          return (
            <article
              key={video.id}
              data-clip-index={index}
              className="relative h-[100dvh] w-full snap-start snap-always overflow-hidden bg-black md:h-[min(100dvh,925px)]"
            >
              {video.videoUrl ? (
                <video
                  ref={element => {
                    videoRefs.current[video.id] = element;
                    if (element) element.muted = mutedRef.current;
                  }}
                  src={video.videoUrl}
                  poster={video.thumbnailUrl ?? undefined}
                  playsInline
                  muted={muted}
                  loop
                  preload={isActive ? "auto" : "metadata"}
                  tabIndex={0}
                  aria-label={`Clip by ${creator?.name || "creator"}: ${getClipTitle(video)}`}
                  onPointerDown={event => handleVideoPointer(event, video)}
                  onKeyDown={event => handleVideoKeyDown(event, video)}
                  onLoadStart={() =>
                    setLoading(current => ({ ...current, [video.id]: true }))
                  }
                  onLoadedData={() =>
                    setLoading(current => ({ ...current, [video.id]: false }))
                  }
                  onCanPlay={() =>
                    setLoading(current => ({ ...current, [video.id]: false }))
                  }
                  onPlay={event => {
                    setPlaying(current => ({ ...current, [video.id]: true }));
                    if (isActive) markView(video, event.currentTarget.currentTime);
                  }}
                  onPause={() =>
                    setPlaying(current => ({ ...current, [video.id]: false }))
                  }
                  onTimeUpdate={event => {
                    if (isActive) markView(video, event.currentTarget.currentTime);
                  }}
                  onError={() => {
                    setLoading(current => ({ ...current, [video.id]: false }));
                    setPlaying(current => ({ ...current, [video.id]: false }));
                    setVideoErrors(current => ({
                      ...current,
                      [video.id]: "This clip could not be loaded.",
                    }));
                  }}
                  className="absolute inset-0 size-full bg-black object-cover"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center bg-black px-6 text-center">
                  <div>
                    <Flag className="mx-auto size-8 text-white/60" aria-hidden="true" />
                    <p className="mt-3 font-semibold">Video unavailable</p>
                    <p className="mt-1 text-sm text-white/60">This clip has no playable video URL.</p>
                  </div>
                </div>
              )}

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/80" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

              {isLoading && !videoError && video.videoUrl && (
                <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center" role="status">
                  <span className="grid size-14 place-items-center rounded-full bg-black/45 backdrop-blur">
                    <Loader2 className="size-7 animate-spin text-white" />
                  </span>
                  <span className="sr-only">Loading clip</span>
                </div>
              )}

              {videoError && (
                <div className="absolute inset-0 z-30 grid place-items-center bg-black/60 px-6 text-center backdrop-blur-[2px]">
                  <div>
                    <p className="font-semibold">{videoError}</p>
                    <button
                      type="button"
                      onClick={() => retryVideo(video)}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-black"
                    >
                      <RefreshCw className="size-4" />
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {isActive && !isPlaying && !videoError && video.videoUrl && (
                <button
                  type="button"
                  onClick={() => togglePlayback(video)}
                  aria-label="Play clip"
                  className="absolute left-1/2 top-1/2 z-20 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur"
                >
                  <Play className="ml-1 size-7 fill-current" />
                </button>
              )}

              {heartAnimation === video.id && (
                <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center" aria-hidden="true">
                  <Heart className="size-28 animate-[ping_.65s_ease-out] fill-white text-white drop-shadow-2xl" />
                </div>
              )}

              <div className="absolute inset-x-0 bottom-0 z-20 pb-[max(16px,env(safe-area-inset-bottom))]">
                <div className="flex items-end gap-3 px-4 pb-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {creatorHref ? (
                        <Link
                          href={creatorHref}
                          aria-label={`Open ${creator?.name || "creator"}`}
                        >
                          <CreatorAvatar creator={creator} />
                        </Link>
                      ) : (
                        <CreatorAvatar creator={creator} />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          {creatorHref ? (
                            <Link href={creatorHref} className="truncate text-sm font-extrabold">
                              {creator?.name || "HkTube Creator"}
                            </Link>
                          ) : (
                            <span className="truncate text-sm font-extrabold">
                              {creator?.name || "HkTube Creator"}
                            </span>
                          )}
                          {creator?.verified && (
                            <BadgeCheck className="size-4 shrink-0 fill-sky-500 text-white" aria-label="Verified creator" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void follow(video)}
                          disabled={busy[video.id]}
                          aria-pressed={isFollowed}
                          className="mt-1 rounded-full border border-white/50 bg-black/35 px-3 py-1 text-xs font-bold backdrop-blur disabled:opacity-60"
                        >
                          {isFollowed ? "Following" : "Follow"}
                        </button>
                      </div>
                    </div>

                    <p className="mt-3 line-clamp-3 text-sm font-medium leading-5 drop-shadow-lg">
                      {getClipTitle(video)}
                      {video.description ? ` · ${video.description}` : ""}
                    </p>

                    {hashtags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm font-bold">
                        {hashtags.map(tag => (
                          <span key={tag}>#{tag}</span>
                        ))}
                      </div>
                    )}

                  </div>

                  <aside className="flex shrink-0 flex-col items-center gap-3 pb-1">
                    <ActionButton
                      label={isLiked ? "Unlike" : "Like"}
                      count={count}
                      active={isLiked}
                      disabled={busy[video.id]}
                      onClick={() => void likeVideo(video)}
                    >
                      <Heart className={isLiked ? "size-7 fill-current text-red-500" : "size-7"} />
                    </ActionButton>

                    <ActionButton
                      label="Open comments"
                      count={comments}
                      onClick={() => {
                        window.location.assign(`/watch/${video.id}#comments`);
                      }}
                    >
                      <MessageCircle className="size-7" />
                    </ActionButton>

                    <ActionButton
                      label={isSaved ? "Remove from saved" : "Save clip"}
                      active={isSaved}
                      disabled={busy[video.id]}
                      onClick={() => void save(video)}
                    >
                      <Bookmark className={isSaved ? "size-7 fill-current" : "size-7"} />
                    </ActionButton>

                    <ActionButton label="Share clip" onClick={() => void share(video)}>
                      <Share2 className="size-7" />
                    </ActionButton>

                    <button
                      type="button"
                      aria-label={menuOpen ? "Close clip options" : "Open clip options"}
                      aria-expanded={menuOpen}
                      onClick={() => setMenus(current => ({ ...current, [video.id]: !current[video.id] }))}
                      className="grid size-11 place-items-center rounded-full bg-black/20 text-white backdrop-blur-[2px]"
                    >
                      <MoreVertical className="size-7" />
                    </button>

                    <button
                      type="button"
                      aria-label={muted ? "Unmute clips" : "Mute clips"}
                      aria-pressed={!muted}
                      onClick={() => setMuted(value => !value)}
                      className="grid size-11 place-items-center rounded-full bg-black/20 text-white backdrop-blur-[2px]"
                    >
                      {muted ? <VolumeX className="size-6" /> : <Volume2 className="size-6" />}
                    </button>
                  </aside>
                </div>

                {shareFeedback === video.id && (
                  <div className="pointer-events-none mx-4 mb-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-black shadow-lg">
                    <Link2 className="size-4" />
                    Link copied
                  </div>
                )}

                {menuOpen && (
                  <div className="mx-4 mb-2 grid grid-cols-2 gap-2 rounded-2xl border border-white/15 bg-black/80 p-2 text-sm font-semibold backdrop-blur-xl">
                    <button
                      type="button"
                      onClick={() => void save(video)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-white/10"
                    >
                      <Bookmark className="size-4" />
                      {isSaved ? "Unsave" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void share(video)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-white/10"
                    >
                      <Share2 className="size-4" />
                      Share
                    </button>
                    <button
                      type="button"
                      onClick={() => void feedback(video, "not_interested")}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-white/10"
                    >
                      <EyeOff className="size-4" />
                      Not interested
                    </button>
                    <button
                      type="button"
                      onClick={() => void feedback(video, "hide_creator")}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-white/10"
                    >
                      <UserRoundX className="size-4" />
                      Hide creator
                    </button>
                    <button
                      type="button"
                      onClick={() => void feedback(video, "less_like_this")}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-white/10"
                    >
                      <EyeOff className="size-4" />
                      Show less
                    </button>
                    <button
                      type="button"
                      onClick={() => void report(video)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-rose-300 hover:bg-white/10"
                    >
                      <Flag className="size-4" />
                      Report
                    </button>
                  </div>
                )}

                <div className="px-4 text-[10px] font-semibold text-white/55">
                  {formatCount(video.viewCount)} views
                </div>
              </div>

              <button
                type="button"
                aria-label={isPlaying ? "Pause clip" : "Play clip"}
                onClick={() => togglePlayback(video)}
                className="absolute right-3 top-3 z-20 grid size-10 place-items-center rounded-full bg-black/25 text-white backdrop-blur-sm"
              >
                {isPlaying ? <Pause className="size-5" /> : <Play className="size-5 fill-current" />}
              </button>
            </article>
          );
        })}
      </div>
      {inlineError && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white/80 backdrop-blur">
          {inlineError}
        </div>
      )}
    </section>
  );
}
