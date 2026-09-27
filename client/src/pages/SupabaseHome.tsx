import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { SupabaseVideoCard } from "@/components/SupabaseVideoCard";
import type { RankedVideo } from "@/lib/supabaseDiscovery";
import { useAuth } from "@/_core/hooks/useAuth";
import { ChevronDown, Heart, Loader2, MessageCircle, MoreVertical, Play, RefreshCw, Save, Share2, UploadCloud, Volume2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { startLogin } from "@/const";
import { recordVideoView, toggleVideoLike, toggleVideoSave } from "@/lib/supabaseEngagement";

function Section({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3 px-4 sm:px-0">
        <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="shrink-0 text-sm font-bold text-violet-200 hover:text-violet-100"
          >
            See all
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
function card(
  v: RankedVideo,
  onFeedback: (
    type:
      | "not_interested"
      | "hide_creator"
      | "hide_topic"
      | "more_like_this"
      | "less_like_this"
  ) => void
) {
  return {
    id: v.id,
    title: v.title,
    thumbnailUrl: v.thumbnailUrl,
    durationSeconds: v.durationSeconds,
    views: v.viewCount,
    publishedAt: v.publishedAt,
    isShort: v.tags.includes("shorts"),
    reason: v.reason,
    onFeedback,
  };
}
function uniqueById(items: RankedVideo[]) {
  return [...new Map(items.map(item => [item.id, item])).values()];
}
function withoutIds(items: RankedVideo[], ids: Set<string>) {
  return items.filter(item => !ids.has(item.id));
}

function ago(value: string | null) {
  if (!value) return "Recently";
  const hours = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 36e5));
  return hours < 24 ? `${hours} hours ago` : `${Math.floor(hours / 24)} days ago`;
}

function HomeVideoPost({ video, index }: { video: RankedVideo; index: number }) {
  const media = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(true);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [menu, setMenu] = useState(false);
  const creator = index === 0 ? "HkTube Creator" : "Wanderlust Diaries";
  const description = video.description || "Exploring the most beautiful places on earth. Nature, adventure and amazing views!";
  const play = () => {
    const element = media.current;
    if (!element) return;
    if (element.paused) {
      void element.play().then(() => setPaused(false)).catch(() => setPaused(true));
    } else {
      element.pause();
      setPaused(true);
    }
  };
  const like = async () => {
    try {
      const result = await toggleVideoLike(video.id);
      setLiked(result.liked);
    } catch (error) {
      if (String(error).toLowerCase().includes("sign")) startLogin();
      else toast.error(error instanceof Error ? error.message : "Could not update like.");
    }
  };
  const save = async () => {
    try {
      setSaved(await toggleVideoSave(video.id));
    } catch (error) {
      if (String(error).toLowerCase().includes("sign")) startLogin();
      else toast.error(error instanceof Error ? error.message : "Could not save video.");
    }
  };
  const share = async () => {
    const url = `${window.location.origin}/watch/${video.id}`;
    try {
      if (navigator.share) await navigator.share({ title: video.title, url });
      else await navigator.clipboard.writeText(url);
      toast.success("Video link ready to share.");
    } catch { /* cancelled share */ }
  };
  return (
    <article className="hktube-home-post bg-white">
      <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
        <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-900 text-sm font-black text-white">
          {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="size-full object-cover" /> : "HK"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[15px] font-bold text-slate-950">
            <span className="truncate">{creator}</span>
          </div>
        </div>
        <button type="button" onClick={() => setFollowed(value => !value)} className={`rounded-lg px-4 py-2 text-sm font-bold ${followed ? "bg-slate-200 text-slate-700" : "bg-slate-950 text-white"}`}>{followed ? "Following" : "Follow"}</button>
        <button type="button" onClick={() => setMenu(value => !value)} className="grid size-9 place-items-center text-slate-700" aria-label="More options"><MoreVertical className="size-5" /></button>
      </div>
      <Link href={`/watch/${video.id}`} className="block px-3 pb-3 sm:px-4">
        <h2 className="line-clamp-2 text-[19px] font-bold leading-6 text-slate-950">{video.title}</h2>
        <ChevronDown className="ml-auto mt-1 size-5 text-slate-500" />
      </Link>
      <div className="relative w-full bg-black aspect-video overflow-hidden">
        <video ref={media} src={video.videoUrl} poster={video.thumbnailUrl || undefined} muted playsInline preload="metadata" className="size-full object-cover" onPlay={() => { setPaused(false); void recordVideoView(video.id, 0).catch(() => undefined); }} onPause={() => setPaused(true)} onTimeUpdate={event => setProgress(event.currentTarget.duration ? event.currentTarget.currentTime / event.currentTarget.duration : 0)} />
        <button type="button" onClick={play} className="absolute inset-0 m-auto grid size-16 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm" aria-label={paused ? "Play video" : "Pause video"}>{paused ? <Play className="ml-1 size-8 fill-current" /> : <span className="text-3xl font-black">Ⅱ</span>}</button>
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 text-xs font-semibold text-white"><span>0:00</span><div className="h-1 flex-1 overflow-hidden rounded-full bg-white/40"><div className="h-full bg-red-500" style={{ width: `${progress * 100}%` }} /></div><span>{Math.floor(video.durationSeconds / 60)}:{String(video.durationSeconds % 60).padStart(2, "0")}</span><Volume2 className="size-5" /><button type="button" onClick={() => media.current?.requestFullscreen()} aria-label="Fullscreen"><Maximize2 className="size-5" /></button></div>
      </div>
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 sm:px-4">
        <button type="button" onClick={() => void like()} className={`home-action ${liked ? "text-violet-700" : ""}`}><Heart className={`size-5 ${liked ? "fill-current" : ""}`} /><span>{(video.likesCount + (liked ? 1 : 0)).toLocaleString()}</span></button>
        <Link href={`/watch/${video.id}#comments`} className="home-action"><MessageCircle className="size-5" /><span>Comments</span></Link>
        <button type="button" onClick={() => void share()} className="home-action"><Share2 className="size-5" /><span>Share</span></button>
        <button type="button" onClick={() => void save()} className={`home-action ${saved ? "text-violet-700" : ""}`}><Save className={`size-5 ${saved ? "fill-current" : ""}`} /><span>Save</span></button>
        <button type="button" onClick={() => setMenu(value => !value)} className="home-action"><MoreVertical className="size-5" /><span>More</span></button>
      </div>
      <div className="flex gap-3 px-3 py-3 sm:px-4">
        <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-900 text-xs font-black text-white">HK</div>
        <div className="min-w-0"><p className="font-bold text-slate-950">{creator}</p><p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">{description}</p><p className="mt-1 text-sm text-slate-500">{video.viewCount.toLocaleString()} views · {ago(video.publishedAt)}</p></div>
      </div>
      {menu && <div className="border-t border-slate-200 px-4 py-2 text-sm text-slate-600">Recommendation options are available on the video page.</div>}
    </article>
  );
}

export default function SupabaseHome() {
  const { user } = useAuth();
  const userId = user?.id;
  const [videos, setVideos] = useState<RankedVideo[]>([]);
  const [shorts, setShorts] = useState<RankedVideo[]>([]);
  const [continueWatching, setContinueWatching] = useState<RankedVideo[]>([]);
  const [following, setFollowing] = useState<RankedVideo[]>([]);
  const [historyVideos, setHistoryVideos] = useState<RankedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { loadSupabaseHomeData } = await import("@/lib/supabaseHomeData");
      const result = await loadSupabaseHomeData(userId);
      setVideos(result.videos);
      setShorts(result.shorts);
      setFollowing(result.following);
      setContinueWatching(result.continueWatching);
      setHistoryVideos(result.historyVideos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load HkTube feed.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [userId]);

  async function feedback(
    videoId: string,
    type:
      | "not_interested"
      | "hide_creator"
      | "hide_topic"
      | "more_like_this"
      | "less_like_this"
  ) {
    try {
      const { updateRecommendation } = await import("@/lib/supabaseHomeData");
      await updateRecommendation(videoId, type);
      if (
        type === "not_interested" ||
        type === "hide_creator" ||
        type === "hide_topic" ||
        type === "less_like_this"
      ) {
        setVideos(items => items.filter(v => v.id !== videoId));
        setShorts(items => items.filter(v => v.id !== videoId));
      }
      toast.success(
        type === "more_like_this"
          ? "We’ll show more like this."
          : type === "less_like_this"
            ? "We’ll show less like this."
            : type === "hide_creator"
              ? "Creator hidden from recommendations."
              : type === "hide_topic"
                ? "Topic hidden from recommendations."
                : "We’ll show fewer like this."
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not update recommendations."
      );
    }
  }

  const compactCards =
    typeof window !== "undefined" &&
    localStorage.getItem("hktube-compact-cards") === "enabled";
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
  const longFeed = useMemo(
    () => uniqueById(feedPool.filter(v => !v.tags.includes("shorts"))),
    [feedPool]
  );
  const recommended = useMemo(() => longFeed.slice(0, 12), [longFeed]);
  const featuredVideo = recommended[0];
  const recommendedGrid = recommended.slice(2);
  const usedRecommended = useMemo(
    () => new Set(recommended.map(v => v.id)),
    [recommended]
  );
  const continueItems = useMemo(
    () => uniqueById(continueWatching).slice(0, 8),
    [continueWatching]
  );
  const becauseWatched = useMemo(
    () =>
      uniqueById([
        ...historyVideos,
        ...videos.filter(v => v.reason === "similar_to_watched"),
      ])
        .filter(v => !usedRecommended.has(v.id) && !v.tags.includes("shorts"))
        .slice(0, 8),
    [historyVideos, videos, usedRecommended]
  );
  const followingItems = useMemo(
    () =>
      uniqueById(following)
        .filter(v => !usedRecommended.has(v.id) && !v.tags.includes("shorts"))
        .slice(0, 8),
    [following, usedRecommended]
  );
  const newCreators = useMemo(
    () =>
      uniqueById(
        videos.filter(
          v => v.reason === "fresh_creator" && !v.tags.includes("shorts")
        )
      )
        .filter(v => !usedRecommended.has(v.id))
        .slice(0, 8),
    [videos, usedRecommended]
  );
  const risingNow = useMemo(
    () =>
      uniqueById(
        [...videos]
          .filter(v => !v.tags.includes("shorts"))
          .sort((a, b) => Number(b.viewCount || 0) - Number(a.viewCount || 0))
      )
        .filter(v => !usedRecommended.has(v.id))
        .slice(0, 8),
    [videos, usedRecommended]
  );
  const fresh = useMemo(
    () =>
      withoutIds(
        [...videos]
          .filter(v => !v.tags.includes("shorts"))
          .sort(
            (a, b) =>
              new Date(b.publishedAt || 0).getTime() -
              new Date(a.publishedAt || 0).getTime()
          ),
        usedRecommended
      ).slice(0, 8),
    [videos, usedRecommended]
  );

  return (
    <HkTubeShell>
      <main className="hktube-home-feed mx-auto w-full max-w-[920px] pb-16 sm:px-4 lg:px-6">
        <section className="flex justify-end px-3 py-2 sm:px-0">
          <button type="button" onClick={() => window.location.reload()} className="grid size-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-700" aria-label="Refresh feed">
            <RefreshCw className="size-4" />
          </button>
        </section>
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
          <div className="space-y-3 sm:space-y-6">
            {recommended.slice(0, 2).map((video, index) => (
              <HomeVideoPost key={`home-post-${video.id}`} video={video} index={index} />
            ))}

            {recommendedGrid.length > 0 && (
              <Section title="More Long Videos">
                <div
                  className={`grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 ${compactCards ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}
                >
                  {recommendedGrid.map(v => (
                    <SupabaseVideoCard
                      key={`recommended-${v.id}`}
                      video={card(v, type => void feedback(v.id, type))}
                    />
                  ))}
                </div>
              </Section>
            )}

            {shorts.length > 0 && (
              <Section title="Clips" href="/shorts">
                <div className="flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:none]">
                  {uniqueById(shorts)
                    .slice(0, 12)
                    .map(v => (
                      <div
                        key={`clip-${v.id}`}
                        className="w-[62vw] max-w-[260px] shrink-0 snap-start sm:w-[220px]"
                      >
                        <SupabaseVideoCard
                          video={card(v, type => void feedback(v.id, type))}
                        />
                      </div>
                    ))}
                </div>
              </Section>
            )}

            {continueItems.length > 0 && (
              <Section title="Continue Watching">
                <div
                  className={`grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 ${compactCards ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}
                >
                  {continueItems.map(v => (
                    <SupabaseVideoCard
                      key={`continue-${v.id}`}
                      video={card(v, type => void feedback(v.id, type))}
                    />
                  ))}
                </div>
              </Section>
            )}

            {becauseWatched.length > 0 && (
              <Section title="Because You Watched">
                <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {becauseWatched.map(v => (
                    <SupabaseVideoCard
                      key={`because-${v.id}`}
                      video={card(v, type => void feedback(v.id, type))}
                    />
                  ))}
                </div>
              </Section>
            )}
            {followingItems.length > 0 && (
              <Section title="From Channels You Follow">
                <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {followingItems.map(v => (
                    <SupabaseVideoCard
                      key={`follow-${v.id}`}
                      video={card(v, type => void feedback(v.id, type))}
                    />
                  ))}
                </div>
              </Section>
            )}
            {risingNow.length > 0 && (
              <Section title="Rising Now">
                <div
                  className={`grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 ${compactCards ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}
                >
                  {risingNow.map(v => (
                    <SupabaseVideoCard
                      key={`rising-${v.id}`}
                      video={card(v, type => void feedback(v.id, type))}
                    />
                  ))}
                </div>
              </Section>
            )}
            {fresh.length > 0 && (
              <Section title="Fresh on HkTube">
                <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {fresh.map(v => (
                    <SupabaseVideoCard
                      key={`fresh-${v.id}`}
                      video={card(v, type => void feedback(v.id, type))}
                    />
                  ))}
                </div>
              </Section>
            )}
            {newCreators.length > 0 && (
              <Section title="Discover New Creators">
                <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {newCreators.map(v => (
                    <SupabaseVideoCard
                      key={`new-${v.id}`}
                      video={card(v, type => void feedback(v.id, type))}
                    />
                  ))}
                </div>
              </Section>
            )}
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
