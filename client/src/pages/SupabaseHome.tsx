import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { SupabaseVideoCard } from "@/components/SupabaseVideoCard";
import type { RankedVideo } from "@/lib/supabaseDiscovery";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, RefreshCw, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
  const recommendedGrid = recommended.slice(1);
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
      <main className="mx-auto w-full max-w-[1500px] pb-16 sm:px-7 lg:px-9">
        <section className="flex items-center justify-between gap-3 border-b border-white/7 px-4 py-3 sm:px-0 sm:py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-300">
              Home feed
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Recommended for you
            </h1>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[.04] text-white"
              aria-label="Refresh feed"
            >
              <RefreshCw className="size-4" />
            </button>
            <Link
              href="/explore"
              className="hidden rounded-full bg-violet-500 px-4 py-2 text-sm font-bold text-white sm:inline-flex"
            >
              Explore
            </Link>
          </div>
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
          <div className="space-y-11">
            {featuredVideo && (
              <Section title="Featured for You">
                <Link
                  href={`/watch/${featuredVideo.id}`}
                  className="group block overflow-hidden border-y border-white/10 bg-[#111522] shadow-2xl shadow-black/20 sm:rounded-[28px] sm:border"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-black">
                    {featuredVideo.thumbnailUrl ? (
                      <img
                        src={featuredVideo.thumbnailUrl}
                        alt=""
                        className="size-full object-cover transition duration-500 group-hover:scale-[1.015]"
                        loading="eager"
                        decoding="async"
                      />
                    ) : (
                      <div className="grid size-full place-items-center text-slate-500">
                        No thumbnail
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent p-4 sm:p-7">
                      <p className="max-w-4xl text-xl font-black text-white sm:text-3xl">
                        {featuredVideo.title}
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        {featuredVideo.viewCount.toLocaleString()} views ·{" "}
                        {featuredVideo.publishedAt
                          ? new Date(
                              featuredVideo.publishedAt
                            ).toLocaleDateString()
                          : "Recently published"}
                      </p>
                    </div>
                  </div>
                </Link>
              </Section>
            )}

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
