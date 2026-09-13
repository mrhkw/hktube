import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { addVideoComment, getVideoEngagement, listVideoComments, recordVideoView, toggleChannelSubscription, toggleVideoLike, toggleVideoSave } from "@/lib/supabaseEngagement";
import { Bookmark, Check, Eye, Heart, Loader2, MessageCircle, Play, Share2, UserPlus } from "lucide-react";
import { toast } from "sonner";

type Video = { id: string; creator_id: string; channel_id: string | null; title: string; description: string; video_path: string | null; thumbnail_path: string | null; duration_seconds: number | null; views: number; likes_count: number; published_at: string | null; tags: string[] };
type Channel = { id: string; handle: string; name: string; avatar_url: string | null; subscriber_count: number };

function mediaUrl(bucket: string, path: string | null) { return path ? (/^https?:\/\//i.test(path) ? path : supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl) : null; }

export default function SupabaseWatchVideo() {
  const [, params] = useRoute("/watch/:id");
  const id = params?.id || "";
  const { user } = useAuth();
  const [video, setVideo] = useState<Video | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [related, setRelated] = useState<Video[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [comment, setComment] = useState("");
  const [engagement, setEngagement] = useState({ liked: false, saved: false, subscribed: false, likeCount: 0, subscriberCount: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const viewed = useRef(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase.from("videos").select("id,creator_id,channel_id,title,description,video_path,thumbnail_path,duration_seconds,views,likes_count,published_at,tags").eq("id", id).eq("visibility", "public").eq("status", "published").eq("moderation_status", "approved").maybeSingle();
    if (error || !data) { setVideo(null); setLoading(false); return; }
    setVideo(data as Video);
    if (data.channel_id) {
      const channelResult = await supabase.from("channels").select("id,handle,name,avatar_url,subscriber_count").eq("id", data.channel_id).maybeSingle();
      setChannel((channelResult.data as Channel | null) || null);
    }
    const relatedResult = await supabase.from("videos").select("id,creator_id,channel_id,title,description,video_path,thumbnail_path,duration_seconds,views,likes_count,published_at,tags").eq("visibility", "public").eq("status", "published").eq("moderation_status", "approved").neq("id", id).order("published_at", { ascending: false }).limit(12);
    setRelated((relatedResult.data ?? []) as Video[]);
    setComments(await listVideoComments(id));
    try { setEngagement(await getVideoEngagement(id, data.channel_id)); } catch { /* anonymous viewers can still watch */ }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [id, user?.id]);
  useEffect(() => { if (!video || viewed.current) return; viewed.current = true; void recordVideoView(video.id).then(result => setVideo(current => current ? { ...current, views: Number(result.views) } : current)).catch(() => undefined); }, [video?.id]);

  const videoUrl = useMemo(() => mediaUrl("videos", video?.video_path || null), [video?.video_path]);
  const thumbnailUrl = useMemo(() => mediaUrl("thumbnails", video?.thumbnail_path || null), [video?.thumbnail_path]);

  async function like() {
    if (!user) return startLogin();
    try { const result = await toggleVideoLike(id); setEngagement(current => ({ ...current, liked: result.liked, likeCount: Number(result.count) })); } catch (e) { toast.error(e instanceof Error ? e.message : "Unable to like this video."); }
  }
  async function save() {
    if (!user) return startLogin();
    try { const saved = await toggleVideoSave(id); setEngagement(current => ({ ...current, saved })); toast.success(saved ? "Added to Watch Later." : "Removed from Watch Later."); } catch (e) { toast.error(e instanceof Error ? e.message : "Unable to save this video."); }
  }
  async function subscribe() {
    if (!user) return startLogin();
    if (!channel) return;
    try { const result = await toggleChannelSubscription(channel.id); setEngagement(current => ({ ...current, subscribed: result.subscribed, subscriberCount: Number(result.count) })); setChannel(current => current ? { ...current, subscriber_count: Number(result.count) } : current); toast.success(result.subscribed ? "Subscribed." : "Unsubscribed."); } catch (e) { toast.error(e instanceof Error ? e.message : "Unable to update subscription."); }
  }
  async function submitComment(event: React.FormEvent) {
    event.preventDefault(); if (!comment.trim()) return; if (!user) return startLogin();
    setBusy(true); try { await addVideoComment(id, comment.trim()); setComment(""); setComments(await listVideoComments(id)); toast.success("Comment published."); } catch (e) { toast.error(e instanceof Error ? e.message : "Unable to post comment."); } finally { setBusy(false); }
  }
  async function share() { const url = window.location.href; try { if (navigator.share) await navigator.share({ title: video?.title, url }); else { await navigator.clipboard.writeText(url); toast.success("Video link copied."); } } catch { /* share cancelled */ } }

  if (loading) return <HkTubeShell><div className="grid min-h-[60vh] place-items-center"><Loader2 className="size-8 animate-spin" /></div></HkTubeShell>;
  if (!video || !videoUrl) return <HkTubeShell title="Video unavailable"><div className="mx-auto max-w-xl rounded-3xl border border-neutral-200 bg-white p-8 text-center"><h1 className="text-2xl font-black">This video is unavailable</h1><p className="mt-2 text-sm text-neutral-500">It may still be in moderation, removed, or the link may be incorrect.</p><Link href="/" className="mt-5 inline-flex rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white">Back to HkTube</Link></div></HkTubeShell>;

  return <HkTubeShell immersive={Boolean(video.tags?.includes("shorts"))}>
    <main className="mx-auto grid w-full max-w-[1500px] gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0">
        <div className={video.tags?.includes("shorts") ? "mx-auto max-w-[720px] overflow-hidden rounded-2xl bg-black" : "overflow-hidden rounded-2xl bg-black"}>
          <video src={videoUrl} poster={thumbnailUrl || undefined} controls playsInline preload="metadata" className={video.tags?.includes("shorts") ? "mx-auto aspect-[9/16] max-h-[82vh] w-full object-contain" : "aspect-video w-full object-contain"} onTimeUpdate={e => { const seconds = e.currentTarget.currentTime; if (user && seconds > 0 && Math.floor(seconds) % 15 === 0) void recordVideoView(video.id, seconds).catch(() => undefined); }} />
        </div>
        <div className="border-b border-white/10 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-violet-300">{video.tags?.includes("shorts") ? "HkTube Short" : "HkTube Video"}</p><h1 className="mt-1 text-2xl font-black text-white">{video.title}</h1></div><span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-slate-300"><Eye className="mr-1 inline size-3.5" />{Number(video.views).toLocaleString()} views</span></div>
          {channel && <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-3"><Link href={`/channel/${channel.handle}`} className="flex min-w-0 flex-1 items-center gap-3"><span className="grid size-10 place-items-center overflow-hidden rounded-full bg-violet-500/20 font-bold text-white">{channel.avatar_url ? <img src={channel.avatar_url} alt="" className="size-full object-cover" /> : channel.name.slice(0,1)}</span><span className="min-w-0"><span className="block truncate font-bold text-white">{channel.name}</span><span className="block text-xs text-slate-500">@{channel.handle} · {engagement.subscriberCount.toLocaleString()} subscribers</span></span></Link><Button onClick={() => void subscribe()} disabled={busy} className="rounded-full bg-violet-500 text-white">{engagement.subscribed ? <><Check className="mr-1 size-4" />Subscribed</> : <><UserPlus className="mr-1 size-4" />Subscribe</>}</Button></div>}
          <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={() => void like()} className={engagement.liked ? "border-rose-400/40 bg-rose-500/15 text-rose-100" : "text-white"}><Heart className={`mr-1.5 size-4 ${engagement.liked ? "fill-current" : ""}`} />{engagement.likeCount}</Button><Button variant="outline" onClick={() => void save()} className="text-white"><Bookmark className={`mr-1.5 size-4 ${engagement.saved ? "fill-current" : ""}`} />{engagement.saved ? "Saved" : "Watch later"}</Button><Button variant="outline" onClick={() => void share()} className="text-white"><Share2 className="mr-1.5 size-4" />Share</Button></div>
          <div className="mt-4 rounded-2xl bg-white/[.035] p-4"><p className={`whitespace-pre-wrap text-sm leading-6 text-slate-300 ${expanded ? "" : "line-clamp-4"}`}>{video.description || "No description."}</p>{video.description && video.description.length > 300 && <button className="mt-2 text-xs font-bold text-cyan-300" onClick={() => setExpanded(v => !v)}>{expanded ? "Show less" : "Show more"}</button>}</div>
        </div>
        <section className="py-6"><div className="flex items-center gap-2"><MessageCircle className="size-5 text-fuchsia-300" /><h2 className="text-lg font-black text-white">Comments</h2><span className="text-xs text-slate-500">{comments.length}</span></div><form onSubmit={submitComment} className="mt-4 flex gap-2"><input value={comment} onChange={e => setComment(e.target.value)} placeholder={user ? "Add a public comment…" : "Sign in to comment"} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-sm text-white outline-none" /><Button type="submit" disabled={busy || !comment.trim()}>Post</Button></form><div className="mt-5 space-y-3">{comments.map(item => <article key={item.id} className="rounded-xl border border-white/8 bg-white/[.025] p-4"><p className="text-sm leading-6 text-slate-300">{item.body}</p><p className="mt-2 text-xs text-slate-600">{new Date(item.created_at).toLocaleString()}</p></article>)}{!comments.length && <p className="py-8 text-sm text-slate-500">No comments yet.</p>}</div></section>
      </section>
      <aside><h2 className="mb-4 text-sm font-bold uppercase tracking-[.16em] text-slate-300">Up next</h2><div className="grid gap-4">{related.map(item => <Link key={item.id} href={`/watch/${item.id}`} className="flex gap-3 rounded-xl p-2 transition hover:bg-white/[.05]"><div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-black"><img src={mediaUrl("thumbnails", item.thumbnail_path) || ""} alt="" className="size-full object-cover" /><span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-white">{Number(item.views).toLocaleString()}</span></div><span className="line-clamp-3 text-sm font-semibold text-slate-200">{item.title}</span></Link>)}</div></aside>
    </main>
  </HkTubeShell>;
}
