import { EmptyVideos, VideoCard } from "@/components/VideoCard";
import { HkTubeShell } from "@/components/HkTubeShell";
import { VideoPlayer } from "@/components/VideoPlayer";
import { formatDate, formatViews, VideoRecord } from "@/lib/video";
import { trpc } from "@/lib/trpc";
import { Eye, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useRoute } from "wouter";

export default function WatchVideo() {
  const [, params] = useRoute("/watch/:id");
  const id = Number(params?.id);
  const videoQuery = trpc.videos.byId.useQuery({ id }, { enabled: Number.isInteger(id) && id > 0 });
  const video = videoQuery.data as VideoRecord | undefined;
  const viewedVideoId = useRef<number | null>(null);
  const recordView = trpc.videos.recordView.useMutation();
  const utils = trpc.useUtils();
  const relatedQuery = trpc.videos.related.useQuery({ id: id || 1, category: video?.category || "regular" }, { enabled: Boolean(video) });
  const related = (relatedQuery.data ?? []) as VideoRecord[];

  useEffect(() => {
    if (!video || viewedVideoId.current === video.id) return;
    viewedVideoId.current = video.id;
    recordView.mutate({ id: video.id }, { onSuccess: updatedVideo => { utils.videos.byId.setData({ id: video.id }, updatedVideo); } });
  }, [video, recordView, utils]);

  if (videoQuery.isLoading) return <HkTubeShell><div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-7 animate-spin text-fuchsia-300" /></div></HkTubeShell>;
  if (!video) return <HkTubeShell title="Video unavailable"><EmptyVideos title="This video is not available" copy="It may have been removed from the HKTUBE catalog or the link is incorrect." /></HkTubeShell>;

  return <HkTubeShell>
    <div className="mx-auto max-w-[1560px] xl:grid xl:grid-cols-[minmax(0,1fr)_330px] xl:gap-7">
      <section className="min-w-0">
        <VideoPlayer video={video} />
        <div className="border-b border-white/8 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-xs font-semibold uppercase tracking-[.17em] text-cyan-300">{video.category === "shorts" ? "HKTUBE Short" : "HKTUBE Video"}</span><h1 className="mt-1.5 text-xl font-bold tracking-tight text-white sm:text-2xl">{video.title}</h1></div><span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/20 bg-violet-400/8 px-3 py-1.5 text-xs font-medium text-violet-100"><Eye className="size-3.5" />{formatViews(video.viewCount)}</span></div>
          <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-400">{video.description || "No description was provided for this video."}</p>
          <p className="mt-3 text-xs text-slate-600">Published {formatDate(video.uploadedAt)}</p>
        </div>
      </section>
      <aside className="mt-7 xl:mt-0"><h2 className="mb-4 text-sm font-bold uppercase tracking-[.16em] text-slate-300">Related videos</h2>{relatedQuery.isLoading ? <div className="space-y-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-white/5" />)}</div> : related.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">{related.map(item => <VideoCard key={item.id} video={item} compact />)}</div> : <EmptyVideos title="No related videos" copy="Related videos will appear as authentic content is published." />}</aside>
    </div>
  </HkTubeShell>;
}
