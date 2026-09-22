import { useEffect, useRef, useState } from "react";
import { Bookmark, Heart, MessageCircle, Play, Share2, Volume2, VolumeX } from "lucide-react";
import { Link } from "wouter";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { recordDiscoveryEvent } from "@/lib/supabaseDiscovery";
import { recordVideoView, toggleVideoLike, toggleVideoSave } from "@/lib/supabaseEngagement";
import { toast } from "sonner";
import type { SupabaseVideo } from "@/lib/supabaseVideos";

export type ShortsPlayerProps = { items: SupabaseVideo[]; startIndex?: number };

export function ShortsPlayer({ items, startIndex = 0 }: ShortsPlayerProps) {
  const { user } = useAuth();
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState<Record<string, boolean>>({});
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [likes, setLikes] = useState<Record<string, number>>({});
  const refs = useRef<Record<string, HTMLVideoElement | null>>({});
  const viewed = useRef(new Set<string>());

  useEffect(() => {
    setPaused({});
    setLiked({});
    setSaved({});
    setLikes(Object.fromEntries(items.map(item => [item.id, Number((item as any).likesCount ?? 0)])));
    refs.current = {};
    viewed.current.clear();
  }, [items]);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const id = (entry.target as HTMLElement).dataset.shortId;
        const video = id ? refs.current[id] : null;
        if (!id || !video) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
          video.muted = muted;
          void video.play().then(() => setPaused(s => ({ ...s, [id]: false }))).catch(() => setPaused(s => ({ ...s, [id]: true })));
          if (!viewed.current.has(id)) {
            viewed.current.add(id);
            void recordVideoView(id).catch(() => undefined);
            void recordDiscoveryEvent({ eventType: "play_start", objectType: "short", objectId: id }).catch(() => undefined);
          }
        } else video.pause();
      });
    }, { threshold: [0.2, 0.7, 0.9] });

    const timer = window.setTimeout(() => document.querySelectorAll<HTMLElement>("[data-short-id]").forEach(node => observer.observe(node)), 0);
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, [items, muted]);

  async function like(id: string) {
    if (!user) return startLogin();
    try {
      const result = await toggleVideoLike(id);
      setLiked(s => ({ ...s, [id]: result.liked }));
      setLikes(s => ({ ...s, [id]: Number(result.count) }));
      void recordDiscoveryEvent({ eventType: result.liked ? "like" : "unlike", objectType: "short", objectId: id }).catch(() => undefined);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update Like."); }
  }

  async function save(id: string) {
    if (!user) return startLogin();
    try {
      const result = await toggleVideoSave(id);
      setSaved(s => ({ ...s, [id]: result }));
      toast.success(result ? "Saved to Library." : "Removed from Library.");
      void recordDiscoveryEvent({ eventType: result ? "save" : "unsave", objectType: "short", objectId: id }).catch(() => undefined);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update Save."); }
  }

  async function share(item: SupabaseVideo) {
    const url = new URL(`/watch/${item.id}`, window.location.origin).toString();
    try {
      if (navigator.share) await navigator.share({ title: item.title, url });
      else { await navigator.clipboard.writeText(url); toast.success("Clip link copied."); }
      void recordDiscoveryEvent({ eventType: "share", objectType: "short", objectId: item.id }).catch(() => undefined);
    } catch {}
  }

  function playToggle(id: string) {
    const video = refs.current[id];
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  }

  return <div className="fixed inset-0 z-[90] bg-black text-white">
    <div className="h-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain [scrollbar-width:none]">
      {items.map((item, index) => <section key={item.id} data-short-id={item.id} className="relative flex h-[100dvh] snap-start items-center justify-center overflow-hidden bg-black">
        <video
          ref={element => { refs.current[item.id] = element; }}
          src={item.videoUrl}
          poster={item.thumbnailUrl || undefined}
          playsInline autoPlay={index === startIndex} muted={muted} loop
          preload={index <= startIndex + 1 ? "auto" : "metadata"}
          className="absolute inset-0 size-full object-contain"
          onClick={() => playToggle(item.id)}
          onDoubleClick={() => void like(item.id)}
          onPlay={() => setPaused(s => ({ ...s, [item.id]: false }))}
          onPause={() => setPaused(s => ({ ...s, [item.id]: true }))}
          onError={() => toast.error("This Clip could not be played.")}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/25" />
        <div className="absolute bottom-5 left-4 right-20 z-20 max-w-xl sm:left-8">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-200">HkTube Clip</p>
          <h1 className="mt-2 line-clamp-2 text-lg font-black">{item.title}</h1>
          {item.description && <p className="mt-1 line-clamp-2 text-sm text-white/75">{item.description}</p>}
        </div>
        <div className="absolute bottom-6 right-3 z-20 flex flex-col items-center gap-2">
          <button onClick={() => void like(item.id)} className="grid size-12 place-items-center rounded-full bg-black/45 backdrop-blur" aria-label="Like"><Heart className={liked[item.id] ? "size-6 fill-current text-rose-400" : "size-6"} /></button>
          <span className="text-[10px] font-bold">{(likes[item.id] ?? 0).toLocaleString()}</span>
          <Link href={`/watch/${item.id}#comments`} className="grid size-12 place-items-center rounded-full bg-black/45 backdrop-blur" aria-label="Comments"><MessageCircle className="size-6" /></Link>
          <button onClick={() => void save(item.id)} className="grid size-12 place-items-center rounded-full bg-black/45 backdrop-blur" aria-label="Save"><Bookmark className={saved[item.id] ? "size-6 fill-current" : "size-6"} /></button>
          <button onClick={() => void share(item)} className="grid size-12 place-items-center rounded-full bg-black/45 backdrop-blur" aria-label="Share"><Share2 className="size-6" /></button>
          <button onClick={() => setMuted(v => !v)} className="grid size-12 place-items-center rounded-full bg-black/45 backdrop-blur" aria-label={muted ? "Unmute" : "Mute"}>{muted ? <VolumeX className="size-6" /> : <Volume2 className="size-6" />}</button>
          {paused[item.id] && <button onClick={() => playToggle(item.id)} className="fixed left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/50" aria-label="Play"><Play className="ml-1 size-8 fill-current" /></button>}
        </div>
      </section>)}
    </div>
  </div>;
}
