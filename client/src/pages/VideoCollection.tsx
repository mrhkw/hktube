import { EmptyVideos, VideoCard } from "@/components/VideoCard";
import { HkTubeShell } from "@/components/HkTubeShell";
import { VideoRecord } from "@/lib/video";
import { trpc } from "@/lib/trpc";

export function VideoCollection({ kind }: { kind: "shorts" | "trending" | "subscriptions" | "library" }) {
  const isShorts = kind === "shorts";
  const isTrending = kind === "trending";
  const query = isShorts ? trpc.videos.shorts.useQuery({ limit: 36 }) : isTrending ? trpc.videos.trending.useQuery({ limit: 36 }) : null;
  const videos = (query?.data ?? []) as VideoRecord[];
  const labels = {
    shorts: { title: "Shorts", subtitle: "Vertical, fast-moving videos from the HKTUBE catalog.", empty: "There are no authentic shorts in the catalog yet." },
    trending: { title: "Trending", subtitle: "Videos ordered by their current live view count.", empty: "Trending will appear as viewers watch published HKTUBE videos." },
    subscriptions: { title: "Subscriptions", subtitle: "Subscriptions will appear here when this feature is enabled for signed-in viewers.", empty: "No subscriptions to show yet." },
    library: { title: "Library", subtitle: "Your personal saved-video library will appear here when this feature is enabled.", empty: "Your library is empty." },
  }[kind];

  return <HkTubeShell title={labels.title} subtitle={labels.subtitle}>
    {kind === "subscriptions" || kind === "library" ? <EmptyVideos title={labels.title === "Subscriptions" ? "Nothing to show yet" : "No saved videos"} copy={labels.empty} /> : query?.isLoading ? <VideoGridSkeleton /> : query?.isError ? <EmptyVideos title="Videos could not be loaded" copy="Please refresh the page. The catalog is read directly from the live HKTUBE database." /> : videos.length ? <div className={isShorts ? "grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 xl:grid-cols-5" : "grid gap-x-4 gap-y-7 sm:grid-cols-2 xl:grid-cols-4"}>{videos.map(video => <VideoCard key={video.id} video={video} compact={isShorts} />)}</div> : <EmptyVideos title="No videos published" copy={labels.empty} />}
  </HkTubeShell>;
}

function VideoGridSkeleton() {
  return <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="animate-pulse"><div className="aspect-video rounded-xl bg-white/5" /><div className="mt-3 h-4 w-4/5 rounded bg-white/6" /><div className="mt-2 h-3 w-1/2 rounded bg-white/5" /></div>)}</div>;
}
