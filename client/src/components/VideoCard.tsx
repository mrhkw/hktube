import { Badge } from "@/components/ui/badge";
import { formatDate, formatDuration, formatViews, VideoRecord } from "@/lib/video";
import { Inbox, Play, Sparkles, type LucideIcon } from "lucide-react";
import { Link } from "wouter";

export function VideoCard({ video, compact = false }: { video: VideoRecord; compact?: boolean }) {
  return (
    <Link href={`/watch/${video.id}`} className="group block min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-4">
      <article className="overflow-hidden rounded-2xl">
        <div className={`relative overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-[0_1px_2px_rgba(0,0,0,.04)] transition duration-200 group-hover:-translate-y-0.5 group-hover:border-neutral-300 group-hover:shadow-[0_12px_30px_rgba(0,0,0,.09)] ${compact ? "aspect-[16/10]" : "aspect-video"}`}>
          {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt={`${video.title} thumbnail`} loading="lazy" decoding="async" className="size-full object-cover transition duration-500 group-hover:scale-[1.025]" /> : <div className="grid size-full place-items-center bg-neutral-100"><span className="grid size-12 place-items-center rounded-full bg-black text-white shadow-sm"><Play className="size-5 fill-current" /></span></div>}
          <span className="pointer-events-none absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 scale-90 place-items-center rounded-full bg-black/85 text-white opacity-0 shadow-lg transition duration-200 group-hover:scale-100 group-hover:opacity-100"><Play className="size-5 fill-current" /></span>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent opacity-80" />
          <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/90 px-2 py-1 text-[11px] font-semibold tabular-nums text-white">{formatDuration(video.durationSeconds)}</span>
          {video.category === "shorts" && <Badge className="absolute left-2.5 top-2.5 border-0 bg-black text-[10px] font-bold text-white shadow-sm">CLIP</Badge>}
          {video.category === "regular" && <Badge className="absolute left-2.5 top-2.5 border-0 bg-white/95 text-[10px] font-bold text-neutral-900 shadow-sm">VIDEO</Badge>}
        </div>
        <div className="flex gap-3 px-1 pt-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-black text-white"><Sparkles className="size-4" /></span>
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-[15px] font-bold leading-5 tracking-[-0.01em] text-neutral-950 transition group-hover:text-neutral-600">{video.title}</h3>
            <p className="mt-1.5 text-xs font-medium text-neutral-500">{formatViews(video.viewCount)} <span className="mx-1">•</span> {formatDate(video.uploadedAt)}</p>
          </div>
        </div>
      </article>
    </Link>
  );
}

export function EmptyVideos({ title, copy, icon: Icon = Inbox }: { title: string; copy: string; icon?: LucideIcon }) {
  return <div className="rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-16 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-black text-white"><Icon className="size-5" aria-hidden="true" /></span><h2 className="mt-4 text-lg font-bold text-neutral-950">{title}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-neutral-500">{copy}</p></div>;
}
