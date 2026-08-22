import { EmptyVideos, VideoCard } from "@/components/VideoCard";
import { HkTubeShell } from "@/components/HkTubeShell";
import { VideoRecord } from "@/lib/video";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

export default function Home() {
  const latestQuery = trpc.videos.latest.useQuery({ limit: 20 });
  const videos = (latestQuery.data ?? []) as VideoRecord[];

  return <HkTubeShell><section className="mx-auto min-h-[calc(100dvh-265px)] max-w-[1480px] px-5 py-12 sm:px-8 sm:py-8 lg:px-10">{latestQuery.isLoading ? <div className="grid min-h-[48vh] place-items-center"><Loader2 className="size-8 animate-spin text-violet-400" /></div> : latestQuery.isError ? <div className="grid min-h-[48vh] place-items-center text-center"><div><h1 className="text-[28px] font-bold tracking-tight text-white">Videos could not load</h1><p className="mx-auto mt-3 max-w-sm text-[18px] leading-7 text-slate-400">Please refresh and try again. HkTube only shows records from the live catalog.</p></div></div> : videos.length ? <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">{videos.map(video => <VideoCard key={video.id} video={video} />)}</div> : <div className="grid min-h-[48vh] place-items-center text-center"><div><h1 className="text-[32px] font-bold tracking-tight text-white">No videos yet</h1><p className="mx-auto mt-3 max-w-sm text-[20px] leading-7 text-slate-400">Be the first to upload content on HkTube!</p></div></div>}</section></HkTubeShell>;
}
