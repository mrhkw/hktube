import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import type { RankedVideo } from "@/lib/supabaseDiscovery";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  BadgeCheck,
  ChevronDown,
  Heart,
  Loader2,
  MessageCircle,
  MoreVertical,
  Play,
  RefreshCw,
  Save,
  Share2,
  UploadCloud,
  Volume2,
  VolumeX,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { startLogin } from "@/const";
import { supabase } from "@/lib/supabase";
import {
  getVideoEngagement,
  listVideoComments,
  recordVideoView,
  reportVideo,
  toggleChannelSubscription,
  toggleVideoLike,
  toggleVideoSave,
} from "@/lib/supabaseEngagement";
import {
  recordDiscoveryEvent,
  setRecommendationFeedback,
} from "@/lib/supabaseDiscovery";

function formatUploadedAge(value: string | null) {
  if (!value) return "Recently";
  const publishedAt = Date.parse(value);
  if (!Number.isFinite(publishedAt) || publishedAt > Date.now()) {
    return "Recently";
  }
  const minutes = Math.max(1, Math.floor((Date.now() - publishedAt) / 60000));
  if (minutes < 60)
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

let activeHomeVideo: HTMLVideoElement | null = null;

type HomeChannel = {
  id: string;
  handle: string;
  name: string;
  avatar_url: string | null;
  verification_status?: string;
};
type HomeProfile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
};

function HomeVideoPost({ video }: { video: RankedVideo }) {
  const media = useRef<HTMLVideoElement>(null);
  const article = useRef<HTMLElement>(null);
  const engagementRequest = useRef<Promise<void> | null>(null);
  const viewRecorded = useRef(false);
  const lastSavedSecond = useRef(0);
  const controlsHideTimer = useRef<number | null>(null);
  const { user } = useAuth();
  const [paused, setPaused] = useState(true);
  const [playbackActive, setPlaybackActive] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likesCount);
  const [channel, setChannel] = useState<HomeChannel | null>(null);
  const [profile, setProfile] = useState<HomeProfile | null>(null);
  const [muted, setMuted] = useState(true);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.durationSeconds);
  const [commentCount, setCommentCount] = useState(0);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [nearViewport, setNearViewport] = useState(false);
  const creator =
    channel?.name ||
    profile?.display_name ||
    profile?.username ||
    "HkTube Creator";
  const creatorAvatar = channel?.avatar_url || profile?.avatar_url;
  const creatorVerified =
    channel?.verification_status === "verified" ||
    profile?.is_verified === true;
  const creatorHref = channel?.handle ? `/channel/${channel.handle}` : null;
  const description = video.description || "";
  const showPlayerOverlay = playbackActive && (controlsVisible || paused);
  useEffect(() => {
    const node = article.current;
    if (!node) return;
    if (!("IntersectionObserver" in window)) {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "520px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = media.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      setPlaybackActive(true);
      return;
    }
    const observer = new IntersectionObserver(
      entries =>
        setPlaybackActive(
          entries.some(
            entry => entry.isIntersecting && entry.intersectionRatio >= 0.62
          )
        ),
      { threshold: [0, 0.62, 1] }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = media.current;
    if (!element) return;
    if (!playbackActive) {
      element.pause();
      if (activeHomeVideo === element) activeHomeVideo = null;
      if (controlsHideTimer.current !== null) {
        window.clearTimeout(controlsHideTimer.current);
        controlsHideTimer.current = null;
      }
      setControlsVisible(false);
      return;
    }
    let cancelled = false;
    let retryCount = 0;
    let retryTimer: number | null = null;
    const startPlayback = () => {
      if (cancelled || !playbackActive) return;
      if (activeHomeVideo && activeHomeVideo !== element) {
        activeHomeVideo.pause();
      }
      activeHomeVideo = element;
      element.defaultMuted = mutedRef.current;
      element.muted = mutedRef.current;
      if (mutedRef.current) element.setAttribute("muted", "");
      else element.removeAttribute("muted");
      void element.play().then(
        () => {
          if (cancelled || activeHomeVideo !== element) {
            element.pause();
            return;
          }
          setPaused(false);
          setControlsVisible(false);
        },
        () => {
          if (cancelled || activeHomeVideo !== element) return;
          if (retryCount < 2) {
            retryCount += 1;
            retryTimer = window.setTimeout(startPlayback, 250 * retryCount);
            return;
          }
          activeHomeVideo = null;
          setPaused(true);
          setControlsVisible(true);
        }
      );
    };
    if (element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      startPlayback();
    } else {
      element.addEventListener("canplay", startPlayback);
    }
    return () => {
      cancelled = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      element.removeEventListener("canplay", startPlayback);
    };
  }, [playbackActive]);
  useEffect(() => {
    if (media.current) {
      media.current.defaultMuted = muted;
      media.current.muted = muted;
      if (muted) media.current.setAttribute("muted", "");
      else media.current.removeAttribute("muted");
    }
  }, [muted]);
  useEffect(
    () => () => {
      if (controlsHideTimer.current !== null) {
        window.clearTimeout(controlsHideTimer.current);
      }
      if (activeHomeVideo === media.current) {
        media.current?.pause();
        activeHomeVideo = null;
      }
    },
    []
  );
  useEffect(() => {
    if (!nearViewport) return;
    let active = true;
    void Promise.all([
      supabase
        .from("channels")
        .select("id,handle,name,avatar_url,verification_status")
        .eq("id", video.channelId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("username,display_name,avatar_url,is_verified")
        .eq("id", video.creatorId)
        .maybeSingle(),
    ])
      .then(([channelResult, profileResult]) => {
        if (!active) return;
        if (channelResult.data) {
          const row = channelResult.data as HomeChannel;
          setChannel(row);
        }
        if (profileResult.data) setProfile(profileResult.data as HomeProfile);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [nearViewport, video.id, video.channelId]);

  const hydrateEngagement = async () => {
    engagementRequest.current ??= Promise.all([
      getVideoEngagement(video.id, video.channelId),
      listVideoComments(video.id),
    ]).then(([engagement, comments]) => {
      setLiked(engagement.liked);
      setSaved(engagement.saved);
      setFollowed(engagement.subscribed);
      setLikeCount(engagement.likeCount);
      setCommentCount(comments.length);
    });
    return engagementRequest.current;
  };

  const like = async () => {
    if (!user) return startLogin();
    setBusy(true);
    try {
      await hydrateEngagement();
      const result = await toggleVideoLike(video.id);
      setLiked(result.liked);
      setLikeCount(Number(result.count));
      void recordDiscoveryEvent({
        eventType: result.liked ? "like" : "unlike",
        objectType: "video",
        objectId: video.id,
      }).catch(() => undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update like."
      );
    } finally {
      setBusy(false);
    }
  };
  const follow = async () => {
    if (!user) return startLogin();
    setBusy(true);
    try {
      await hydrateEngagement();
      const result = await toggleChannelSubscription(video.channelId);
      setFollowed(result.subscribed);
      if (result.subscribed)
        void recordDiscoveryEvent({
          eventType: "follow",
          objectType: "channel",
          objectId: video.channelId,
        }).catch(() => undefined);
      toast.success(
        result.subscribed ? "Following creator." : "Unfollowed creator."
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update follow."
      );
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!user) return startLogin();
    setBusy(true);
    try {
      await hydrateEngagement();
      const nextSaved = await toggleVideoSave(video.id);
      setSaved(nextSaved);
      void recordDiscoveryEvent({
        eventType: nextSaved ? "save" : "unsave",
        objectType: "video",
        objectId: video.id,
      }).catch(() => undefined);
      toast.success(
        nextSaved ? "Saved to your library." : "Removed from your library."
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update saved videos."
      );
    } finally {
      setBusy(false);
    }
  };
  const report = async () => {
    if (!user) return startLogin();
    try {
      await reportVideo(
        video.id,
        "policy_violation",
        "Reported from the home feed."
      );
      setMenu(false);
      toast.success("Report sent to moderation.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not report this video."
      );
    }
  };
  const feedback = async (
    type: "not_interested" | "less_like_this" | "hide_creator"
  ) => {
    if (!user) return startLogin();
    try {
      await setRecommendationFeedback(
        video.id,
        type,
        video.category || video.tags[0] || null
      );
      setMenu(false);
      if (type === "not_interested" || type === "hide_creator") setHidden(true);
      toast.success("Your recommendation preference was saved.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update recommendations."
      );
    }
  };
  const share = async () => {
    const url = `${window.location.origin}/watch/${video.id}`;
    try {
      if (navigator.share) await navigator.share({ title: video.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Video link copied.");
      }
      void recordDiscoveryEvent({
        eventType: "share",
        objectType: "video",
        objectId: video.id,
      }).catch(() => undefined);
    } catch {
      /* share cancelled */
    }
  };
  const showPlayerControls = () => {
    setControlsVisible(true);
    if (controlsHideTimer.current !== null) {
      window.clearTimeout(controlsHideTimer.current);
      controlsHideTimer.current = null;
    }
    const element = media.current;
    if (element && !element.paused) {
      controlsHideTimer.current = window.setTimeout(() => {
        setControlsVisible(false);
        controlsHideTimer.current = null;
      }, 2800);
    }
  };
  const play = () => {
    const element = media.current;
    if (!element) return;
    if (!element.paused) {
      element.pause();
      setPaused(true);
      setControlsVisible(true);
      if (controlsHideTimer.current !== null) {
        window.clearTimeout(controlsHideTimer.current);
        controlsHideTimer.current = null;
      }
      if (activeHomeVideo === element) activeHomeVideo = null;
      return;
    }
    if (activeHomeVideo && activeHomeVideo !== element) {
      activeHomeVideo.pause();
    }
    activeHomeVideo = element;
    void element.play().then(
      () => {
        setPaused(false);
        showPlayerControls();
      },
      () => {
        setPaused(true);
        setControlsVisible(true);
      }
    );
  };
  if (hidden) return null;
  return (
    <article
      ref={article}
      className="hktube-home-post hktube-mobile-card bg-white"
    >
      <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
        {creatorHref ? (
          <Link
            href={creatorHref}
            className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-900 text-sm font-black text-white"
          >
            {creatorAvatar ? (
              <img
                src={creatorAvatar}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />
            ) : (
              "HK"
            )}
          </Link>
        ) : (
          <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-900 text-sm font-black text-white">
            {creatorAvatar ? (
              <img
                src={creatorAvatar}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />
            ) : (
              "HK"
            )}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="hktube-channel-name flex min-w-0 items-center gap-1 text-[15px] font-bold text-[#8f1d1d]">
            {creatorHref ? (
              <Link href={creatorHref} className="truncate">
                {creator}
              </Link>
            ) : (
              <span className="truncate">{creator}</span>
            )}
            {creatorVerified && (
              <BadgeCheck className="size-4 shrink-0 fill-sky-500 text-white" />
            )}
          </div>
          <p className="truncate text-[11px] leading-4 text-slate-500">
            {video.viewCount.toLocaleString()} views ·{" "}
            {formatUploadedAge(video.publishedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void follow()}
          disabled={busy}
          aria-pressed={followed}
          data-hktube-follow={followed ? "following" : "available"}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${followed ? "bg-red-50 ring-1 ring-red-200 hover:bg-red-100" : "bg-red-600 hover:bg-red-700"}`}
        >
          {followed ? "Following" : "Follow"}
        </button>
        <button
          type="button"
          onClick={() => setMenu(value => !value)}
          className="grid size-9 place-items-center text-slate-700"
          aria-label="More options"
        >
          <MoreVertical className="size-5" />
        </button>
      </div>
      <Link
        href={`/watch/${video.id}`}
        className="flex items-start gap-2 px-3 pb-3 sm:px-4"
      >
        <h2 className="min-w-0 flex-1 line-clamp-2 text-[18px] font-bold leading-6 text-slate-950">
          {video.title}
        </h2>
        <ChevronDown
          className="mt-1 size-4 shrink-0 text-slate-500"
          aria-hidden="true"
        />
      </Link>
      <div className="relative w-full bg-black aspect-video overflow-hidden">
        <video
          ref={media}
          src={video.videoUrl}
          poster={nearViewport ? video.thumbnailUrl || undefined : undefined}
          autoPlay={playbackActive}
          muted={muted}
          playsInline
          preload={nearViewport ? "metadata" : "none"}
          className="size-full object-cover"
          onClick={showPlayerControls}
          onLoadedMetadata={event =>
            setDuration(
              Number.isFinite(event.currentTarget.duration)
                ? event.currentTarget.duration
                : video.durationSeconds
            )
          }
          onPlay={() => {
            setPaused(false);
            activeHomeVideo = media.current;
            if (!viewRecorded.current) {
              viewRecorded.current = true;
              void recordVideoView(video.id, 0).catch(() => undefined);
            }
            void recordDiscoveryEvent({
              eventType: "play_start",
              objectType: "video",
              objectId: video.id,
            }).catch(() => undefined);
          }}
          onPause={event => {
            setPaused(true);
            if (activeHomeVideo === event.currentTarget) activeHomeVideo = null;
          }}
          onEnded={() => {
            setPaused(true);
            void recordDiscoveryEvent({
              eventType: "complete",
              objectType: "video",
              objectId: video.id,
              watchSeconds: duration,
              positionSeconds: duration,
            }).catch(() => undefined);
          }}
          onTimeUpdate={event => {
            const element = event.currentTarget;
            const seconds = Math.floor(element.currentTime);
            setCurrentTime(element.currentTime);
            if (
              user &&
              seconds > 0 &&
              seconds - lastSavedSecond.current >= 15
            ) {
              lastSavedSecond.current = seconds;
              void supabase
                .from("watch_history")
                .upsert(
                  {
                    user_id: user.id,
                    video_id: video.id,
                    progress_seconds: seconds,
                    watched_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "user_id,video_id" }
                )
                .then(
                  () => undefined,
                  () => undefined
                );
            }
          }}
        />
        {showPlayerOverlay && (
          <button
            type="button"
            onClick={play}
            className="home-play-button absolute inset-0 m-auto grid size-14 place-items-center rounded-full text-white backdrop-blur-sm"
            aria-label={paused ? "Play video" : "Pause video"}
          >
            {paused ? (
              <Play className="ml-1 size-7 fill-current" />
            ) : (
              <span className="text-2xl font-black">Ⅱ</span>
            )}
          </button>
        )}
        {showPlayerOverlay && (
          <div
            onPointerDown={showPlayerControls}
            className="absolute inset-x-3 bottom-3 flex items-center gap-2 text-xs font-semibold text-white"
          >
            <span className="min-w-9">
              {Math.floor(currentTime / 60)}:
              {String(Math.floor(currentTime % 60)).padStart(2, "0")}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={Math.min(currentTime, duration || 1)}
              aria-label="Video progress"
              className="h-1 min-w-0 flex-1 cursor-pointer accent-red-500"
              onChange={event => {
                const time = Number(event.currentTarget.value);
                setCurrentTime(time);
                if (media.current) media.current.currentTime = time;
              }}
            />
            <span>
              {Math.floor(duration / 60)}:
              {String(Math.floor(duration % 60)).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={() => {
                setMuted(value => !value);
                showPlayerControls();
              }}
              aria-label={muted ? "Unmute video" : "Mute video"}
            >
              {muted ? (
                <VolumeX className="size-5" />
              ) : (
                <Volume2 className="size-5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                showPlayerControls();
                const player = media.current;
                if (player?.requestFullscreen) void player.requestFullscreen();
                else toast.info("Fullscreen is not supported by this browser.");
              }}
              aria-label="Fullscreen"
            >
              <Maximize2 className="size-5" />
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={() => void like()}
          disabled={busy}
          className={`home-action ${liked ? "text-red-700" : ""}`}
        >
          <Heart className={`size-5 ${liked ? "fill-current" : ""}`} />
          <span>{likeCount.toLocaleString()}</span>
        </button>
        <Link href={`/watch/${video.id}#comments`} className="home-action">
          <MessageCircle className="size-5" />
          <span>
            {commentCount ? commentCount.toLocaleString() : "Comments"}
          </span>
        </Link>
        <button
          type="button"
          onClick={() => void share()}
          className="home-action"
        >
          <Share2 className="size-5" />
          <span>Share</span>
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className={`home-action ${saved ? "text-red-700" : ""}`}
        >
          <Save className={`size-5 ${saved ? "fill-current" : ""}`} />
          <span>{saved ? "Saved" : "Save"}</span>
        </button>
        <button
          type="button"
          onClick={() => setMenu(value => !value)}
          className="home-action"
        >
          <MoreVertical className="size-5" />
          <span>More</span>
        </button>
      </div>
      {menu && (
        <div className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-slate-50 p-3 text-left text-sm sm:grid-cols-3">
          <button
            type="button"
            onClick={() => void feedback("not_interested")}
            className="rounded-lg px-3 py-2 text-left hover:bg-white"
          >
            Not interested
          </button>
          <button
            type="button"
            onClick={() => void feedback("less_like_this")}
            className="rounded-lg px-3 py-2 text-left hover:bg-white"
          >
            Show less like this
          </button>
          <button
            type="button"
            onClick={() => void feedback("hide_creator")}
            className="rounded-lg px-3 py-2 text-left hover:bg-white"
          >
            Reduce creator
          </button>
          <button
            type="button"
            onClick={() => void report()}
            className="rounded-lg px-3 py-2 text-left text-rose-700 hover:bg-white"
          >
            Report video
          </button>
          <Link
            href={channel?.handle ? `/channel/${channel.handle}` : "/profile"}
            className="rounded-lg px-3 py-2 hover:bg-white"
          >
            Open creator
          </Link>
        </div>
      )}
      {description && (
        <div className="flex gap-3 border-t border-slate-100 px-3 py-3 sm:px-4">
          <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-900 text-xs font-black text-white">
            {creatorAvatar ? (
              <img
                src={creatorAvatar}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />
            ) : (
              "HK"
            )}
          </div>
          <div className="min-w-0">
            <p className="hktube-channel-name flex items-center gap-1 text-sm font-semibold text-[#8f1d1d]">
              <span className="truncate">{creator}</span>
              {creatorVerified && (
                <BadgeCheck className="size-4 shrink-0 fill-sky-500 text-white" />
              )}
            </p>
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">
              {description}
            </p>
          </div>
        </div>
      )}
    </article>
  );
}

export default function SupabaseHome() {
  const { user } = useAuth();
  const userId = user?.id;
  const [videos, setVideos] = useState<RankedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { loadSupabaseHomeData } = await import("@/lib/supabaseHomeData");
      const result = await loadSupabaseHomeData(userId);
      setVideos(result.videos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load HkTube feed.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [userId]);

  const personalizedFeed =
    typeof window !== "undefined"
      ? localStorage.getItem("hktube-personalized-feed") !== "disabled"
      : true;
  const feedPool = useMemo(
    () =>
      personalizedFeed
        ? videos
        : [...videos].sort(
            (a, b) =>
              new Date(b.publishedAt || 0).getTime() -
              new Date(a.publishedAt || 0).getTime()
          ),
    [videos, personalizedFeed]
  );
  const recommended = useMemo(() => {
    const longVideos = feedPool.filter(video => !video.tags.includes("shorts"));
    return [...new Map(longVideos.map(video => [video.id, video])).values()];
  }, [feedPool]);

  return (
    <HkTubeShell>
      <main className="hktube-home-feed mx-auto w-full max-w-[920px] bg-white pb-16 sm:px-4 lg:px-6">
        {loading ? (
          <div className="grid min-h-[42vh] place-items-center">
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <Loader2 className="size-5 animate-spin text-violet-300" />
              Loading your feed…
            </div>
          </div>
        ) : error ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[.03] p-8 text-center">
            <p className="font-semibold text-white">
              We couldn’t load your feed.
            </p>
            <p className="mt-2 text-sm text-slate-500">{error}</p>
            <Button
              onClick={() => void load()}
              className="mt-5 bg-violet-500 hover:bg-violet-400"
            >
              <RefreshCw className="mr-2 size-4" />
              Retry
            </Button>
          </div>
        ) : videos.length ? (
          <div className="space-y-0">
            {recommended.map(video => (
              <HomeVideoPost key={`home-post-${video.id}`} video={video} />
            ))}
          </div>
        ) : (
          <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-white/10 bg-white/[.02] p-10 text-center sm:p-14">
            <UploadCloud className="mx-auto size-10 text-violet-300" />
            <h2 className="mt-4 text-2xl font-bold text-white">
              HkTube is ready for its first uploads
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              There are no public videos available yet. Once original content is
              published, this page will build the personalized feed.
            </p>
            <Link
              href="/explore"
              className="mt-5 inline-flex rounded-full bg-violet-500 px-5 py-2.5 text-sm font-bold text-white"
            >
              Explore HkTube
            </Link>
          </div>
        )}
      </main>
    </HkTubeShell>
  );
}
