import { useState } from "react";
import { Bookmark, Heart, Play, Share2 } from "lucide-react";
import { Link } from "wouter";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toggleVideoLike, toggleVideoSave } from "@/lib/supabaseEngagement";
import { toast } from "sonner";

type ShortItem = { id: string; title: string; description: string | null; video_path: string | null; thumbnail_path: string | null; views: number; likes_count: number; channel_id: string | null; tags: string[] | null };
type Channel = { id: string; handle: string; name: string; avatar_url: string | null };

function mediaUrl(bucket: string, path: string | null) {
  return path ? (/^https?:\/\//i.test(path) ? path : supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl) : null;
}

export function ShortsSwipeFeed({ items }: { items: ShortItem[] }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>(() => Object.fromEntries(items.map(item => [item.id, Number(item.likes_count || 0)])));
  const [channels, setChannels] = useState<Record<string, Channel>>({});

  useState(() => {
    const ids = [...new Set(items.map(item => item.channel_id).filter(Boolean))] as string[];
    if (!ids.length) return;
    void supabase.from("channels").select("id,handle,name,avatar_url").in("id", ids).then(({ data }) => {
      setChannels(Object.fromEntries((data ?? []).map(channel => [String(channel.id), channel as Channel])));
    });
  });

  async function like(id: string) {
    if (!user) return startLogin();
    try {
      const result = await toggleVideoLike(id);
      setLiked(state => ({ ...state, [id]: result.liked }));
      setLikeCounts(state => ({ ...state, [id]: Number(result.count) }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to like this Short.");
    }
  }

  async function save(id: string) {
    if (!user) return startLogin();
    try {
      const result = await toggleVideoSave(id);
      setSaved(state => ({ ...state, [id]: result }));
      toast.success(result ? "Saved to Library." : "Removed from Library.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save this Short.");
    }
  }

  async function share(item: ShortItem) {
    const url = `${window.location.origin}/watch/${item.id}`;
    try {
      if (navigator.share) await navigator.share({ title: item.title, url });
      else { await navigator.clipboard.writeText(url); toast.success("Short link copied."); }
    } catch { /* cancelled */ }
  }

  return <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
    {items.map(item => {
      const channel = item.channel_id ? channels[item.channel_id] : undefined;
      const thumb = mediaUrl("thumbnails", item.thumbnail_path);
      const videoUrl = mediaUrl("videos", item.video_path);
      return <article key={item.id} className="group min-w-0">
        <Link href={`/watch/${item.id}`} className="block overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-violet-500">
          <div className="relative aspect-[9/14] overflow-hidden bg-slate-100">
            {thumb ? <img src={thumb} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.035]" /> : <div className="grid size-full place-items-center bg-slate-900 text-white"><Play className="size-10 opacity-70" /></div>}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/5 opacity-70" />
            <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white backdrop-blur">Short</span>
            <span className="absolute inset-0 grid place-items-center opacity-0 transition duration-200 group-hover:opacity-100"><span className="grid size-12 place-items-center rounded-full bg-white/90 text-slate-900 shadow-lg"><Play className="ml-0.5 size-5 fill-current" /></span></span>
            <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">{Number(item.views || 0).toLocaleString()} views</span>
          </div>
        </Link>
        <div className="px-1 pt-2">
          <div className="flex items-start gap-2">
            {channel?.avatar_url ? <img src={channel.avatar_url} alt="" className="mt-0.5 size-7 shrink-0 rounded-full object-cover" /> : <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-violet-100 text-[10px] font-black text-violet-700">{channel?.name?.slice(0, 1) || "H"}</span>}
            <div className="min-w-0 flex-1">
              <Link href={`/watch/${item.id}`} className="line-clamp-2 text-sm font-bold leading-5 text-slate-900 hover:text-violet-700">{item.title}</Link>
              {channel ? <Link href={`/channel/${channel.handle}`} className="mt-0.5 block truncate text-xs text-slate-500 hover:text-violet-700">@{channel.handle}</Link> : null}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1">
            <button type="button" onClick={() => void like(item.id)} className="grid size-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-rose-600" aria-label="Like Short"><Heart className={`size-4 ${liked[item.id] ? "fill-current text-rose-500" : ""}`} /></button>
            <span className="mr-1 text-[11px] text-slate-500">{(likeCounts[item.id] || 0).toLocaleString()}</span>
            <button type="button" onClick={() => void save(item.id)} className="grid size-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-violet-700" aria-label="Save Short"><Bookmark className={`size-4 ${saved[item.id] ? "fill-current text-violet-600" : ""}`} /></button>
            <button type="button" onClick={() => void share(item)} className="grid size-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-violet-700" aria-label="Share Short"><Share2 className="size-4" /></button>
          </div>
        </div>
      </article>;
    })}
  </div>;
}
