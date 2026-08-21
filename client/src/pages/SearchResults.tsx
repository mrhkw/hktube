import { EmptyVideos, VideoCard } from "@/components/VideoCard";
import { HkTubeShell } from "@/components/HkTubeShell";
import { VideoRecord } from "@/lib/video";
import { trpc } from "@/lib/trpc";
import { Loader2, Search } from "lucide-react";

export default function SearchResults() {
  const query = new URLSearchParams(window.location.search).get("q")?.trim() || "";
  const resultsQuery = trpc.videos.search.useQuery({ query, limit: 48 }, { enabled: Boolean(query) });
  const videos = (resultsQuery.data ?? []) as VideoRecord[];
  return <HkTubeShell title={query ? `Results for “${query}”` : "Search HKTUBE"} subtitle={query ? "Matches from video titles and descriptions in the live catalog." : "Enter a term in the search bar to find published HKTUBE videos."}>
    {!query ? <EmptyVideos title="Search the catalog" copy="Use the search bar to discover videos by title or description." icon={Search} /> : resultsQuery.isLoading ? <div className="grid min-h-[28vh] place-items-center"><Loader2 className="size-7 animate-spin text-fuchsia-300" aria-label="Searching" /></div> : resultsQuery.isError ? <EmptyVideos title="Search could not load" copy="Please refresh and try again. Search reads only from the live HkTube video catalog." icon={Search} /> : videos.length ? <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2 xl:grid-cols-4">{videos.map(video => <VideoCard key={video.id} video={video} />)}</div> : <EmptyVideos title="No matching videos" copy="No published HKTUBE video matches this search. Try a different title or keyword." icon={Search} />}
  </HkTubeShell>;
}
