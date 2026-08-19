import { EmptyVideos, VideoCard } from "@/components/VideoCard";
import { HkTubeShell } from "@/components/HkTubeShell";
import { VideoRecord } from "@/lib/video";
import { trpc } from "@/lib/trpc";

export default function SearchResults() {
  const query = new URLSearchParams(window.location.search).get("q")?.trim() || "";
  const resultsQuery = trpc.videos.search.useQuery({ query, limit: 48 });
  const videos = (resultsQuery.data ?? []) as VideoRecord[];
  return <HkTubeShell title={query ? `Results for “${query}”` : "Search HKTUBE"} subtitle={query ? "Matches from video titles and descriptions in the live catalog." : "Enter a term in the search bar to find published HKTUBE videos."}>
    {!query ? <EmptyVideos title="Search the catalog" copy="Use the search bar to discover videos by title or description." /> : resultsQuery.isLoading ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="animate-pulse"><div className="aspect-video rounded-xl bg-white/5" /><div className="mt-3 h-4 w-3/4 rounded bg-white/6" /></div>)}</div> : videos.length ? <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2 xl:grid-cols-4">{videos.map(video => <VideoCard key={video.id} video={video} />)}</div> : <EmptyVideos title="No matching videos" copy="No published HKTUBE video matches this search. Try a different title or keyword." />}
  </HkTubeShell>;
}
