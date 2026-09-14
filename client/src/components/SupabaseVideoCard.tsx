import { MoreVertical, Play, Sparkles } from "lucide-react";
import { Link } from "wouter";

export type SupabaseVideoCardData = { id: string; title: string; thumbnailUrl: string | null; durationSeconds: number | null; views: number; publishedAt: string | null; isShort?: boolean; channelName?: string | null; channelHandle?: string | null; reason?: string | null; onNotInterested?: () => void };

function duration(seconds: number | null) { const value = Math.max(0, Math.floor(seconds || 0)); const h = Math.floor(value / 3600); const m = Math.floor((value % 3600) / 60); const s = value % 60; return h ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` : `${m}:${String(s).padStart(2,"0")}`; }
function reasonLabel(reason?: string | null) { return ({ interest_match:"Based on your interests", followed_creator:"From a creator you follow", similar_to_watched:"Similar to what you watched", trending:"Trending for you", fresh_creator:"New creator", search_related:"Related to your search", fresh:"Fresh on HkTube" } as Record<string,string>)[reason || ""] || null; }

export function SupabaseVideoCard({ video }: { video: SupabaseVideoCardData }) {
  const reason = reasonLabel(video.reason);
  return <article className="group relative min-w-0">
    <Link href={`/watch/${video.id}`} className="block">
      <div className={`relative overflow-hidden rounded-2xl bg-[#171c28] ${video.isShort ? "aspect-[9/16]" : "aspect-video"}`}>
        {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" loading="lazy" className="size-full object-cover transition duration-300 group-hover:scale-[1.03]" /> : <div className="grid size-full place-items-center"><span className="grid size-12 place-items-center rounded-full bg-black text-white"><Play className="size-5 fill-current" /></span></div>}
        <span className="absolute bottom-2 right-2 rounded-md bg-black/85 px-2 py-1 text-[11px] font-semibold text-white">{duration(video.durationSeconds)}</span>
        {video.isShort && <span className="absolute left-2 top-2 rounded-md bg-black px-2 py-1 text-[10px] font-bold text-white">SHORT</span>}
      </div>
      <div className="mt-3 flex gap-3">
        <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-black text-slate-200">{(video.channelName || video.channelHandle || "H").slice(0,1).toUpperCase()}</div>
        <div className="min-w-0"><h3 className="line-clamp-2 text-[15px] font-bold leading-5 text-white">{video.title}</h3><p className="mt-1 truncate text-xs text-slate-500">{video.channelName || (video.channelHandle ? `@${video.channelHandle}` : "HkTube creator")}</p><p className="mt-0.5 text-xs text-slate-500">{Number(video.views).toLocaleString()} views · {video.publishedAt ? new Date(video.publishedAt).toLocaleDateString() : "Recently"}</p>{reason && <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-violet-300"><Sparkles className="size-3" />{reason}</p>}</div>
      </div>
    </Link>
    {video.onNotInterested && <button type="button" onClick={event => { event.preventDefault(); event.stopPropagation(); video.onNotInterested?.(); }} className="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur transition group-hover:opacity-100" aria-label="More options"><MoreVertical className="size-4" /></button>}
  </article>;
}
