import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Bookmark, Check, Heart, MessageCircle, Share2, Volume2, VolumeX } from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toggleChannelSubscription, toggleVideoLike, toggleVideoSave } from "@/lib/supabaseEngagement";
import { toast } from "sonner";

type ShortItem = { id: string; title: string; description: string | null; video_path: string | null; thumbnail_path: string | null; views: number; likes_count: number; channel_id: string | null; tags: string[] | null };
type Channel = { id: string; handle: string; name: string; avatar_url: string | null; subscriber_count: number };

function mediaUrl(bucket: string, path: string | null) { return path ? (/^https?:\/\//i.test(path) ? path : supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl) : null; }

export function ShortsSwipeFeed({ items }: { items: ShortItem[] }) {
  const { user } = useAuth();
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>(() => Object.fromEntries(items.map(item => [item.id, Number(item.likes_count || 0)])));
  const [channels, setChannels] = useState<Record<string, Channel>>({});
  const refs = useRef<Record<string, HTMLVideoElement | null>>({});

  useEffect(() => {
    const ids = [...new Set(items.map(item => item.channel_id).filter(Boolean))] as string[];
    if (!ids.length) return;
    let cancelled = false;
    void supabase.from("channels").select("id,handle,name,avatar_url,subscriber_count").in("id", ids).then(({ data }) => {
      if (!cancelled) setChannels(Object.fromEntries((data ?? []).map(channel => [String(channel.id), channel as Channel])));
    });
    return () => { cancelled = true; };
  }, [items]);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const index = Number((visible.target as HTMLElement).dataset.index || 0);
      setActive(index);
    }, { threshold: [0.6, 0.85] });
    Object.values(refs.current).forEach(video => { if (video) observer.observe(video.closest("article") || video); });
    return () => observer.disconnect();
  }, [items.length]);

  useEffect(() => {
    Object.entries(refs.current).forEach(([id, video]) => {
      if (!video) return;
      const index = items.findIndex(item => item.id === id);
      if (index === active) { video.muted = muted; void video.play().catch(() => undefined); }
      else { video.pause(); video.currentTime = 0; }
    });
  }, [active, muted, items]);

  async function like(id: string) {
    if (!user) return startLogin();
    try { const result = await toggleVideoLike(id); setLiked(state => ({ ...state, [id]: result.liked })); setLikeCounts(state => ({ ...state, [id]: Number(result.count) })); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to like this Short."); }
  }
  async function save(id: string) {
    if (!user) return startLogin();
    try { const result = await toggleVideoSave(id); setSaved(state => ({ ...state, [id]: result })); toast.success(result ? "Saved to Library." : "Removed from Library."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save this Short."); }
  }
  async function share(item: ShortItem) {
    const url = `${window.location.origin}/watch/${item.id}`;
    try { if (navigator.share) await navigator.share({ title: item.title, url }); else { await navigator.clipboard.writeText(url); toast.success("Short link copied."); } } catch { /* cancelled */ }
  }

  return <div className="relative mx-auto w-full max-w-[720px]">
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-[11px] font-bold text-white backdrop-blur">Swipe up for next</div>
    <div className="h-[calc(100dvh-8.5rem)] min-h-[520px] snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-2xl bg-black [scrollbar-width:none] sm:h-[calc(100dvh-9rem)]">
      {items.map((item, index) => {
        const channel = item.channel_id ? channels[item.channel_id] : undefined;
        const videoUrl = mediaUrl("videos", item.video_path);
        const thumb = mediaUrl("thumbnails", item.thumbnail_path);
        return <article key={item.id} data-index={index} className="relative flex h-full min-h-full snap-start snap-always items-center justify-center bg-black">
          {videoUrl ? <video ref={node => { refs.current[item.id] = node; }} src={videoUrl} poster={thumb || undefined} playsInline loop preload={index < 2 ? "auto" : "metadata"} className="h-full w-full object-contain" onClick={event => { const video = event.currentTarget; if (video.paused) void video.play(); else video.pause(); }} onVolumeChange={event => setMuted(event.currentTarget.muted)} /> : <div className="text-sm text-slate-500">Video unavailable</div>}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-4 pb-6 text-white sm:p-6">
            <div className="min-w-0 max-w-[72%]">
              {channel ? <Link href={`/channel/${channel.handle}`} className="pointer-events-auto mb-2 inline-flex items-center gap-2 rounded-full bg-black/40 pr-3 backdrop-blur"><span className="grid size-8 place-items-center overflow-hidden rounded-full bg-violet-500/50 text-xs font-black">{channel.avatar_url ? <img src={channel.avatar_url} alt="" className="size-full object-cover" /> : channel.name.slice(0, 1)}</span><span className="text-sm font-bold">@{channel.handle}</span></Link> : null}
              <h2 className="text-base font-black leading-5 sm:text-lg">{item.title}</h2>
              {item.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-200/85">{item.description}</p> : null}
              <p className="mt-2 text-[11px] text-slate-300">{Number(item.views || 0).toLocaleString()} views</p>
            </div>
            <div className="pointer-events-auto flex shrink-0 flex-col items-center gap-3">
              <button type="button" onClick={() => void like(item.id)} className="grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur" aria-label="Like Short"><Heart className={`size-5 ${liked[item.id] ? "fill-current text-rose-400" : ""}`} /><span className="sr-only">{likeCounts[item.id] || 0} likes</span></button>
              <Link href={`/watch/${item.id}#comments`} className="grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur" aria-label="Open comments"><MessageCircle className="size-5" /></Link>
              <button type="button" onClick={() => void save(item.id)} className="grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur" aria-label="Save Short"><Bookmark className={`size-5 ${saved[item.id] ? "fill-current text-violet-300" : ""}`} /></button>
              <button type="button" onClick={() => void share(item)} className="grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur" aria-label="Share Short"><Share2 className="size-5" /></button>
              <button type="button" onClick={() => setMuted(value => !value)} className="grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur" aria-label={muted ? "Unmute" : "Mute"}>{muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}</button>
            </div>
          </div>
        </article>;
      })}
    </div>
  </div>;
}
