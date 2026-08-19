import { Badge } from "@/components/ui/badge";
import { formatDate, formatDuration, formatViews, VideoRecord } from "@/lib/video";
import { Clock3, Play, Sparkles } from "lucide-react";
import { Link } from "wouter";

export function VideoCard({ video, compact = false }: { video: VideoRecord; compact?: boolean }) {
  return (
    <Link href={`/watch/${video.id}`} className="group block min-w-0">
      <div className={`relative overflow-hidden rounded-xl border border-white/8 bg-[#131321] ${compact ? "aspect-[16/10]" : "aspect-video"}`}>
        {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt={`${video.title} thumbnail`} className="size-full object-cover transition duration-300 group-hover:scale-[1.035]" /> : <div className="grid size-full place-items-center bg-gradient-to-br from-violet-500/20 via-[#151429] to-cyan-400/10"><Play className="size-8 fill-fuchsia-300 text-fuchsia-300" /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-70" />
        <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white">{formatDuration(video.durationSeconds)}</span>
        {video.category === "shorts" && <Badge className="absolute left-2 top-2 border-0 bg-fuchsia-500/90 text-[10px] font-bold text-white hover:bg-fuchsia-500">SHORT</Badge>}
      </div>
      <div className="flex gap-2.5 pt-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-violet-400/20 bg-violet-500/10 text-violet-200"><Sparkles className="size-3.5" /></span>
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-100 transition group-hover:text-fuchsia-200">{video.title}</h3>
          <p className="mt-1 text-xs text-slate-500">{formatViews(video.viewCount)} <span className="mx-1">•</span> {formatDate(video.uploadedAt)}</p>
        </div>
      </div>
    </Link>
  );
}

export function EmptyVideos({ title, copy }: { title: string; copy: string }) {
  return <div className="rounded-2xl border border-dashed border-white/12 bg-white/[.025] px-6 py-14 text-center"><Clock3 className="mx-auto size-7 text-fuchsia-300/70" /><h2 className="mt-4 text-base font-semibold text-white">{title}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{copy}</p></div>;
}
