import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  BadgeCheck,
  Bookmark,
  Check,
  ChevronDown,
  Copy,
  Flag,
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  Search,
  Send,
  Share2,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  addVideoComment,
  getVideoEngagement,
  listVideoComments,
  recordVideoView,
  reportVideo,
  toggleChannelSubscription,
  toggleVideoLike,
  toggleVideoSave,
} from "@/lib/supabaseEngagement";
import {
  rankPublicVideos,
  recordDiscoveryEvent,
  setRecommendationFeedback,
  type RankedVideo,
} from "@/lib/supabaseDiscovery";
import { listPublicSupabaseShorts } from "@/lib/supabaseVideos";

type ClipProfile = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  verified: boolean;
  handle: string;
};

type ClipItem = RankedVideo & {
  profile: ClipProfile;
};

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  profiles?: {
    username?: string | null;
    avatar_url?: string | null;
  } | null;
};

type Sheet = "comments" | "share" | "more" | null;

const FALLBACK_PROFILE: ClipProfile = {
  username: "hktube_creator",
  displayName: "HkTube Creator",
  avatarUrl: null,
  verified: true,
  handle: "hktube_creator",
};

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return String(Math.max(0, value));
}

function formatAgo(value: string | null) {
  if (!value) return "Recently";
  const ms = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatMusic(video: ClipItem) {
  const clean = (video.tags.find(tag => /sound|music|audio/i.test(tag)) || video.category || "Original Sound").trim();
  return clean ? `${clean} · HkTube Creator` : "Original Sound · HkTube Creator";
}

async function loadProfiles(videos: RankedVideo[]) {
  const channelIds = [...new Set(videos.map(video => video.channelId).filter(Boolean))];
  const creatorIds = [...new Set(videos.map(video => video.creatorId).filter(Boolean))];

  const [channelsResult, profilesResult] = await Promise.all([
    channelIds.length
      ? supabase
          .from("channels")
          .select("id,handle,name,avatar_url,verification_status")
          .in("id", channelIds)
      : Promise.resolve({ data: [], error: null }),
    creatorIds.length
      ? supabase
          .from("profiles")
          .select("id,username,display_name,avatar_url,is_verified")
          .in("id", creatorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const channels = new Map(
    (channelsResult.data ?? []).map(row => [
      String(row.id),
      {
        handle: String(row.handle ?? ""),
        name: String(row.name ?? ""),
        avatar: typeof row.avatar_url === "string" ? row.avatar_url : null,
        verified: String(row.verification_status ?? "") === "verified",
      },
    ])
  );
  const profiles = new Map(
    (profilesResult.data ?? []).map(row => [
      String(row.id),
      {
        username: String(row.username ?? ""),
        displayName: String(row.display_name ?? row.username ?? "HkTube Creator"),
        avatar: typeof row.avatar_url === "string" ? row.avatar_url : null,
        verified: Boolean(row.is_verified),
      },
    ])
  );

  return videos.map(video => {
    const channel = channels.get(video.channelId);
    const profile = profiles.get(video.creatorId);
    const name = channel?.name || profile?.displayName || FALLBACK_PROFILE.displayName;
    const username = profile?.username || channel?.handle || FALLBACK_PROFILE.username;
    return {
      ...video,
      profile: {
        username,
        displayName: name,
        avatarUrl: channel?.avatar || profile?.avatar || null,
        verified: channel?.verified || profile?.verified || false,
        handle: channel?.handle || username,
      },
    };
  });
}

export const ClipsView = () => {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"for-you" | "following">("for-you");
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [followed, setFollowed] = useState<Record<string, boolean>>({});
  const [commentCache, setCommentCache] = useState<Record<string, CommentRow[]>>({});
  const [commentText, setCommentText] = useState("");
  const [heartBurst, setHeartBurst] = useState(false);
  const [busy, setBusy] = useState(false);
  const [moreClip, setMoreClip] = useState<ClipItem | null>(null);
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const lastProgress = useRef<Record<string, number>>({});
  const touchStartY = useRef<number | null>(null);

  const activeClip = clips[activeIndex] ?? null;

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      let ranked = await rankPublicVideos({
        shorts: true,
        limit: 50,
        userId: user?.id ?? null,
      });

      if (!ranked.length) ranked = await listPublicSupabaseShorts(50);

      if (mode === "following" && user?.id) {
        const { data } = await supabase
          .from("subscriptions")
          .select("channel_id")
          .eq("subscriber_id", user.id);
        const followedChannels = new Set((data ?? []).map(row => String(row.channel_id)));
        ranked = ranked.filter(video => followedChannels.has(video.channelId));
      } else if (mode === "following" && !user?.id) {
        ranked = [];
      }

      const enriched = await loadProfiles(ranked);
      setClips(enriched);
      setActiveIndex(0);
      setPlaying(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load Clips.");
      setClips([]);
    } finally {
      setLoading(false);
    }
  }, [mode, user?.id]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    const clip = activeClip;
    if (!clip) return;

    let active = true;
    void getVideoEngagement(clip.id, clip.channelId)
      .then(state => {
        if (!active) return;
        setLiked(current => ({ ...current, [clip.id]: state.liked }));
        setLikeCounts(current => ({ ...current, [clip.id]: state.likeCount }));
        setSaved(current => ({ ...current, [clip.id]: state.saved }));
        setFollowed(current => ({ ...current, [clip.channelId]: state.subscribed }));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [activeClip?.id, activeClip?.channelId]);

  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([id, video]) => {
      if (!video) return;
      if (id === activeClip?.id) {
        video.currentTime = 0;
        video.muted = true;
        video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [activeClip?.id]);

  const setActive = (index: number) => {
    const next = Math.max(0, Math.min(index, clips.length - 1));
    if (next !== activeIndex) {
      setActiveIndex(next);
      setPlaying(true);
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) < 30) return;
    if (event.deltaY > 0) setActive(activeIndex + 1);
    else setActive(activeIndex - 1);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartY.current === null) return;
    const delta = touchStartY.current - event.changedTouches[0].clientY;
    touchStartY.current = null;
    if (Math.abs(delta) < 45) return;
    setActive(delta > 0 ? activeIndex + 1 : activeIndex - 1);
  };

  const togglePlayback = () => {
    if (!activeClip) return;
    const video = videoRefs.current[activeClip.id];
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setPlaying(true)).catch(() => undefined);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const likeClip = async (clip: ClipItem) => {
    if (!user) return startLogin();
    if (busy) return;
    setBusy(true);
    try {
      const result = await toggleVideoLike(clip.id);
      setLiked(current => ({ ...current, [clip.id]: result.liked }));
      setLikeCounts(current => ({ ...current, [clip.id]: Number(result.count) }));
      void recordDiscoveryEvent({
        eventType: result.liked ? "like" : "unlike",
        objectType: "short",
        objectId: clip.id,
      }).catch(() => undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update like.");
    } finally {
      setBusy(false);
    }
  };

  const saveClip = async (clip: ClipItem) => {
    if (!user) return startLogin();
    if (busy) return;
    setBusy(true);
    try {
      const next = await toggleVideoSave(clip.id);
      setSaved(current => ({ ...current, [clip.id]: next }));
      void recordDiscoveryEvent({
        eventType: next ? "save" : "unsave",
        objectType: "short",
        objectId: clip.id,
      }).catch(() => undefined);
      toast.success(next ? "Saved to Library." : "Removed from Library.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this Clip.");
    } finally {
      setBusy(false);
    }
  };

  const followCreator = async (clip: ClipItem) => {
    if (!user) return startLogin();
    if (busy) return;
    setBusy(true);
    try {
      const result = await toggleChannelSubscription(clip.channelId);
      setFollowed(current => ({ ...current, [clip.channelId]: result.subscribed }));
      toast.success(result.subscribed ? "Following creator." : "Unfollowed creator.");
      void recordDiscoveryEvent({
        eventType: result.subscribed ? "follow" : "unfollow",
        objectType: "channel",
        objectId: clip.channelId,
      }).catch(() => undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update follow.");
    } finally {
      setBusy(false);
    }
  };

  const shareClip = async (clip: ClipItem) => {
    const url = `${window.location.origin}/clips?clip=${encodeURIComponent(clip.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: clip.title, text: clip.description || clip.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Clip link copied.");
      }
      void recordDiscoveryEvent({
        eventType: "share",
        objectType: "short",
        objectId: clip.id,
      }).catch(() => undefined);
      setSheet(null);
    } catch {
      // Sharing can be cancelled by the user.
    }
  };

  const openComments = async (clip: ClipItem) => {
    setSheet("comments");
    if (commentCache[clip.id]) return;
    try {
      const rows = await listVideoComments(clip.id);
      setCommentCache(current => ({ ...current, [clip.id]: rows as CommentRow[] }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load comments.");
    }
  };

  const postComment = async (clip: ClipItem) => {
    if (!user) return startLogin();
    const clean = commentText.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      await addVideoComment(clip.id, clean);
      const rows = await listVideoComments(clip.id);
      setCommentCache(current => ({ ...current, [clip.id]: rows as CommentRow[] }));
      setCommentText("");
      void recordDiscoveryEvent({
        eventType: "comment",
        objectType: "short",
        objectId: clip.id,
      }).catch(() => undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not post comment.");
    } finally {
      setBusy(false);
    }
  };

  const reportClip = async (reason: string) => {
    if (!moreClip) return;
    if (!user) return startLogin();
    setBusy(true);
    try {
      await reportVideo(moreClip.id, reason, "Reported from HkTube Clips.");
      toast.success("Report sent to moderation.");
      setSheet(null);
      setMoreClip(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit report.");
    } finally {
      setBusy(false);
    }
  };

  const notInterested = async () => {
    if (!moreClip) return;
    if (!user) return startLogin();
    try {
      await setRecommendationFeedback(
        moreClip.id,
        "not_interested",
        moreClip.category || moreClip.tags[0] || null
      );
      setClips(current => current.filter(item => item.id !== moreClip.id));
      setMoreClip(null);
      setSheet(null);
      toast.success("We will show you fewer Clips like this.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your feed.");
    }
  };

  const copyLink = async (clip: ClipItem) => {
    const url = `${window.location.origin}/clips?clip=${encodeURIComponent(clip.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
      setSheet(null);
    } catch {
      toast.error("Could not copy the link.");
    }
  };

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => document.getElementById("clips-search-input")?.focus(), 50);
  };

  const submitSearch = () => {
    const query = searchValue.trim();
    if (query) navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const triggerHeart = (clip: ClipItem) => {
    if (!liked[clip.id]) void likeClip(clip);
    setHeartBurst(true);
    window.setTimeout(() => setHeartBurst(false), 750);
  };

  const activeComments = activeClip ? commentCache[activeClip.id] ?? [] : [];

  const topTabs = useMemo(
    () => [
      { key: "following" as const, label: "Following" },
      { key: "for-you" as const, label: "For You" },
    ],
    []
  );

  if (loading) {
    return (
      <main className="fixed inset-0 z-[70] grid place-items-center bg-black text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="grid size-12 place-items-center rounded-full border border-white/15 bg-white/10">
            <Loader2 className="size-5 animate-spin" />
          </div>
          <span className="text-xs font-semibold tracking-wide text-white/70">Loading Clips</span>
        </div>
      </main>
    );
  }

  if (!clips.length) {
    return (
      <main className="fixed inset-0 z-[70] grid place-items-center bg-black px-6 text-center text-white">
        <div className="max-w-sm">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-white/10">
            <Play className="size-7" />
          </div>
          <h1 className="mt-5 text-2xl font-black">No Clips yet</h1>
          <p className="mt-2 text-sm leading-6 text-white/60">
            {mode === "following"
              ? "You are not following any creators with public Clips yet."
              : "Publish a vertical Clip and it will appear here."}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setMode("for-you")}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black"
            >
              For You
            </button>
            <button
              type="button"
              onClick={() => navigate("/clips/create")}
              className="rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-bold"
            >
              Create Clip
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="fixed inset-0 z-[70] h-[100dvh] w-full overflow-hidden bg-black text-white"
      onWheel={handleWheel}
      onTouchStart={event => {
        touchStartY.current = event.touches[0].clientY;
      }}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute inset-0">
        {clips.map((clip, index) => {
          const isActive = index === activeIndex;
          const isLiked = Boolean(liked[clip.id]);
          const isSaved = Boolean(saved[clip.id]);
          const isFollowed = Boolean(followed[clip.channelId]);
          const likes = likeCounts[clip.id] ?? clip.likesCount;
          const viewCount = viewCounts[clip.id] ?? clip.viewCount;

          return (
            <section
              key={clip.id}
              className={`absolute inset-0 overflow-hidden bg-black transition-opacity duration-300 ${isActive ? "opacity-100" : "pointer-events-none opacity-0"}`}
              aria-hidden={!isActive}
            >
              <video
                ref={element => {
                  videoRefs.current[clip.id] = element;
                }}
                src={clip.videoUrl}
                poster={clip.thumbnailUrl || undefined}
                playsInline
                muted
                loop
                preload={isActive ? "auto" : "metadata"}
                className="absolute inset-0 size-full object-cover"
                onPlay={() => {
                  if (!isActive) return;
                  setPlaying(true);
                  void recordVideoView(clip.id, 0)
                    .then(result => {
                      setViewCounts(current => ({ ...current, [clip.id]: Number(result.views) }));
                    })
                    .catch(() => undefined);
                  void recordDiscoveryEvent({
                    eventType: "play_start",
                    objectType: "short",
                    objectId: clip.id,
                  }).catch(() => undefined);
                }}
                onPause={() => isActive && setPlaying(false)}
                onTimeUpdate={event => {
                  if (!isActive) return;
                  const second = Math.floor(event.currentTarget.currentTime);
                  if (second > 0 && second - (lastProgress.current[clip.id] ?? 0) >= 15) {
                    lastProgress.current[clip.id] = second;
                    void recordDiscoveryEvent({
                      eventType: "watch_progress",
                      objectType: "short",
                      objectId: clip.id,
                      watchSeconds: second,
                      positionSeconds: second,
                    }).catch(() => undefined);
                  }
                }}
                onEnded={() => {
                  if (!isActive) return;
                  void recordDiscoveryEvent({
                    eventType: "complete",
                    objectType: "short",
                    objectId: clip.id,
                  }).catch(() => undefined);
                  setActive(activeIndex + 1);
                }}
                onClick={togglePlayback}
              />

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/85" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-black/90 via-black/35 to-transparent" />

              <AnimatePresence>
                {isActive && heartBurst && (
                  <motion.div
                    initial={{ scale: 0.25, opacity: 0, rotate: -15 }}
                    animate={{ scale: [0.25, 1.15, 1], opacity: [0, 1, 0], rotate: [0, -8, 8] }}
                    transition={{ duration: 0.72, ease: "easeOut" }}
                    className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2"
                  >
                    <Heart className="size-28 fill-white text-white drop-shadow-[0_12px_35px_rgba(0,0,0,.45)]" />
                  </motion.div>
                )}
              </AnimatePresence>

              {isActive && !playing && (
                <motion.button
                  type="button"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  onClick={togglePlayback}
                  className="absolute left-1/2 top-1/2 z-20 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md"
                  aria-label="Play Clip"
                >
                  <Play className="ml-1 size-7 fill-current" />
                </motion.button>
              )}

              <div className="pointer-events-none absolute inset-x-0 top-0 z-30 pt-[max(12px,env(safe-area-inset-top))]">
                <div className="flex items-center justify-center gap-8 px-5 pt-2">
                  {topTabs.map(tab => {
                    const selected = mode === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setMode(tab.key)}
                        className={`pointer-events-auto relative py-2 text-[16px] font-bold tracking-[-.01em] drop-shadow-[0_2px_7px_rgba(0,0,0,.6)] ${selected ? "text-white" : "text-white/70"}`}
                      >
                        {tab.label}
                        {selected && (
                          <motion.span
                            layoutId="clips-tab-indicator"
                            className="absolute -bottom-0.5 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-white"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={openSearch}
                  className="pointer-events-auto absolute right-4 top-2 grid size-11 place-items-center rounded-full text-white drop-shadow-[0_2px_7px_rgba(0,0,0,.7)]"
                  aria-label="Search Clips"
                >
                  <Search className="size-8 stroke-[2.2]" />
                </button>
              </div>

              <div className="absolute bottom-[max(28px,env(safe-area-inset-bottom))] right-3 z-30 flex w-[64px] flex-col items-center gap-4">
                <button
                  type="button"
                  onClick={() => void followCreator(clip)}
                  className="relative grid size-12 place-items-center rounded-full border-2 border-white bg-black/20 shadow-2xl backdrop-blur-sm"
                  aria-label={isFollowed ? "Unfollow creator" : "Follow creator"}
                >
                  {clip.profile.avatarUrl ? (
                    <img src={clip.profile.avatarUrl} alt="" className="size-full rounded-full object-cover" />
                  ) : (
                    <span className="text-xs font-black">HK</span>
                  )}
                  <span
                    className={`absolute -bottom-2 grid size-5 place-items-center rounded-full border border-black text-[11px] font-black ${isFollowed ? "bg-white text-black" : "bg-red-500 text-white"}`}
                  >
                    {isFollowed ? <Check className="size-3" /> : "+"}
                  </span>
                </button>

                <ActionButton
                  label={formatCount(likes)}
                  active={isLiked}
                  onClick={() => void likeClip(clip)}
                >
                  <Heart className={`size-8 ${isLiked ? "fill-current" : ""}`} />
                </ActionButton>

                <ActionButton
                  label={formatCount(commentCache[clip.id]?.length ?? 0)}
                  onClick={() => void openComments(clip)}
                >
                  <MessageCircle className="size-8" />
                </ActionButton>

                <ActionButton
                  label={formatCount(clip.viewCount)}
                  active={isSaved}
                  onClick={() => void saveClip(clip)}
                >
                  <Star className={`size-8 ${isSaved ? "fill-current" : ""}`} />
                </ActionButton>

                <ActionButton
                  label={formatCount(clip.shares || 0)}
                  onClick={() => {
                    setSheet("share");
                  }}
                >
                  <Send className="size-8 fill-current" />
                </ActionButton>

                <button
                  type="button"
                  onClick={() => {
                    setMoreClip(clip);
                    setSheet("more");
                  }}
                  className="grid size-11 place-items-center rounded-full text-white drop-shadow-[0_2px_7px_rgba(0,0,0,.7)] transition active:scale-90"
                  aria-label="More Clip options"
                >
                  <MoreHorizontal className="size-9" />
                </button>
              </div>

              <div className="absolute bottom-[max(22px,env(safe-area-inset-bottom))] left-4 z-30 max-w-[calc(100%-100px)] pb-1">
                <div className="flex items-center gap-2">
                  {clip.profile.avatarUrl ? (
                    <img src={clip.profile.avatarUrl} alt="" className="size-10 rounded-full border border-white/80 object-cover" />
                  ) : (
                    <div className="grid size-10 place-items-center rounded-full border border-white/80 bg-black text-xs font-black">HK</div>
                  )}
                  <button
                    type="button"
                    onClick={() => void followCreator(clip)}
                    className="flex items-center gap-1.5 text-[17px] font-extrabold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.8)]"
                  >
                    {clip.profile.displayName}
                    <BadgeCheck className="size-5 fill-sky-500 text-white" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void followCreator(clip)}
                    className={`rounded-full px-4 py-1.5 text-sm font-bold shadow-lg transition active:scale-95 ${isFollowed ? "bg-white/20 text-white backdrop-blur-md" : "bg-white text-black"}`}
                  >
                    {isFollowed ? "Following" : "Follow"}
                  </button>
                </div>

                <p className="mt-2 max-w-[520px] text-[15px] font-medium leading-5 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.9)]">
                  {clip.description || clip.title}
                </p>

                <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[14px] font-semibold text-white/95">
                  {(clip.tags.length ? clip.tags.slice(0, 3) : [clip.category || "travel"]).map(tag => (
                    <span key={tag} className="drop-shadow-[0_2px_7px_rgba(0,0,0,.8)">
                      #{tag.replace(/^#/, "")}
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => toast.info("Original sound is from this Clip.")}
                  className="mt-4 flex max-w-full items-center gap-2 rounded-full text-left text-[14px] font-semibold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.9)]"
                >
                  <Music2 className="size-5 shrink-0" />
                  <span className="truncate">{formatMusic(clip)}</span>
                </button>
              </div>

              <button
                type="button"
                onDoubleClick={() => triggerHeart(clip)}
                onClick={() => {
                  if (isActive) togglePlayback();
                }}
                className="absolute inset-x-[78px] inset-y-[18%] z-10 cursor-pointer"
                aria-label="Play or pause Clip"
              />
            </section>
          );
        })}
      </div>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xl"
          >
            <div className="mx-auto mt-[max(22px,env(safe-area-inset-top))] flex max-w-xl items-center gap-2 px-4">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-xl">
                <Search className="size-5 text-white/70" />
                <input
                  id="clips-search-input"
                  value={searchValue}
                  onChange={event => setSearchValue(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter") submitSearch();
                  }}
                  placeholder="Search HkTube"
                  className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/45"
                />
              </div>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10"
                aria-label="Close search"
              >
                <X className="size-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/65 backdrop-blur-[2px]"
            onClick={() => setSheet(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheet === "comments" && activeClip && (
          <motion.section
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="fixed inset-x-0 bottom-0 z-[120] flex h-[72dvh] flex-col rounded-t-[28px] bg-[#101010] text-white shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <span className="text-sm font-bold">Comments</span>
              <button type="button" onClick={() => setSheet(null)} className="grid size-9 place-items-center rounded-full bg-white/10">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {activeComments.length ? (
                <div className="space-y-5">
                  {activeComments.map(comment => (
                    <div key={comment.id} className="flex gap-3">
                      <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10 text-xs font-black">
                        {comment.profiles?.avatar_url ? (
                          <img src={comment.profiles.avatar_url} alt="" className="size-full object-cover" />
                        ) : (
                          "HK"
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white/65">@{comment.profiles?.username || "user"}</p>
                        <p className="mt-1 text-sm leading-5 text-white/95">{comment.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid h-full place-items-center text-center text-sm text-white/45">
                  <div>
                    <MessageCircle className="mx-auto size-8" />
                    <p className="mt-3">No comments yet.</p>
                    <p className="mt-1">Be the first to comment.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-white/10 p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1.5">
                <input
                  value={commentText}
                  onChange={event => setCommentText(event.target.value.slice(0, 2000))}
                  placeholder="Add a comment..."
                  className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-white/35"
                />
                <button
                  type="button"
                  onClick={() => void postComment(activeClip)}
                  disabled={!commentText.trim() || busy}
                  className="grid size-10 place-items-center rounded-full bg-white text-black disabled:opacity-35"
                  aria-label="Post comment"
                >
                  <Send className="size-4 fill-current" />
                </button>
              </div>
            </div>
          </motion.section>
        )}

        {sheet === "share" && activeClip && (
          <motion.section
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="fixed inset-x-0 bottom-0 z-[120] rounded-t-[28px] bg-[#101010] p-5 pb-[max(24px,env(safe-area-inset-bottom))] text-white"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Share Clip</span>
              <button type="button" onClick={() => setSheet(null)} className="grid size-9 place-items-center rounded-full bg-white/10">
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => void shareClip(activeClip)} className="flex items-center gap-3 rounded-2xl bg-white/10 p-4 text-left">
                <Share2 className="size-5" />
                <span className="text-sm font-bold">Share</span>
              </button>
              <button type="button" onClick={() => void copyLink(activeClip)} className="flex items-center gap-3 rounded-2xl bg-white/10 p-4 text-left">
                <Copy className="size-5" />
                <span className="text-sm font-bold">Copy link</span>
              </button>
            </div>
          </motion.section>
        )}

        {sheet === "more" && moreClip && (
          <motion.section
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="fixed inset-x-0 bottom-0 z-[120] rounded-t-[28px] bg-[#101010] p-5 pb-[max(24px,env(safe-area-inset-bottom))] text-white"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Clip options</span>
              <button type="button" onClick={() => setSheet(null)} className="grid size-9 place-items-center rounded-full bg-white/10">
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-4 space-y-2">
              <button type="button" onClick={() => void notInterested()} className="flex w-full items-center gap-3 rounded-2xl bg-white/10 p-4 text-left">
                <Bookmark className="size-5" />
                <span className="text-sm font-semibold">Not interested</span>
              </button>
              <button type="button" onClick={() => void reportClip("policy_violation")} className="flex w-full items-center gap-3 rounded-2xl bg-white/10 p-4 text-left">
                <Flag className="size-5" />
                <span className="text-sm font-semibold">Report Clip</span>
              </button>
              <button type="button" onClick={() => { setSheet(null); setMoreClip(null); }} className="flex w-full items-center justify-center rounded-2xl bg-white/5 p-4 text-sm font-semibold text-white/60">
                Cancel
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
};

function ActionButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full flex-col items-center gap-1 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.8)]"
    >
      <motion.span
        whileTap={{ scale: 0.82 }}
        className={`grid size-12 place-items-center rounded-full bg-black/20 backdrop-blur-[2px] transition-colors ${active ? "text-red-500" : "text-white"}`}
      >
        {children}
      </motion.span>
      <span className="text-[12px] font-bold leading-none">{label}</span>
    </button>
  );
}

export default ClipsView;
