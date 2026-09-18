import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { BarChart3, CheckCircle2, Clock3, FileVideo2, Heart, Loader2, RefreshCw, UploadCloud, Users, Video, XCircle, Settings2, MessageSquare, Sparkles, Eye, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

type Channel = { id: string; name: string; handle: string; avatar_url: string | null; subscriber_count: number };
type CreatorVideo = { id: string; title: string; views: number; likes_count: number; status: string; moderation_status: string; visibility: string; published_at: string | null };

function stat(value: number) { return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0); }
function tone(video: CreatorVideo) {
  if (video.status === "published" && video.moderation_status === "approved") return { label: "Published", icon: CheckCircle2, className: "text-emerald-300 bg-emerald-400/10 border-emerald-400/15" };
  if (video.status === "failed") return { label: "Failed", icon: XCircle, className: "text-rose-300 bg-rose-400/10 border-rose-400/15" };
  return { label: video.moderation_status === "pending" ? "In review" : "Processing", icon: Clock3, className: "text-amber-300 bg-amber-400/10 border-amber-400/15" };
}

export default function CreatorStudio() {
  const { user, isAuthenticated } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [videos, setVideos] = useState<CreatorVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "content">("overview");

  async function load() {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [channelResult, videoResult] = await Promise.all([
        supabase.from("channels").select("id,name,handle,avatar_url,subscriber_count").eq("owner_id", user.id).order("created_at", { ascending: false }),
        supabase.from("videos").select("id,title,views,likes_count,status,moderation_status,visibility,published_at").eq("creator_id", user.id).order("created_at", { ascending: false }).limit(100),
      ]);
      if (channelResult.error) throw channelResult.error;
      if (videoResult.error) throw videoResult.error;
      setChannels((channelResult.data || []) as Channel[]);
      setVideos((videoResult.data || []) as CreatorVideo[]);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load Creator Studio."); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (isAuthenticated) void load(); else setLoading(false); }, [isAuthenticated, user?.id]);

  const published = useMemo(() => videos.filter(v => v.status === "published" && v.moderation_status === "approved"), [videos]);
  const totalViews = useMemo(() => videos.reduce((sum, v) => sum + Number(v.views || 0), 0), [videos]);
  const totalLikes = useMemo(() => videos.reduce((sum, v) => sum + Number(v.likes_count || 0), 0), [videos]);
  const followers = useMemo(() => channels.reduce((sum, c) => sum + Number(c.subscriber_count || 0), 0), [channels]);
  const recent = useMemo(() => [...published].sort((a, b) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime()).slice(0, 5), [published]);

  if (!isAuthenticated) return <HkTubeShell title="Creator Studio" subtitle="Manage your HkTube presence."><div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[.03] p-10 text-center"><Video className="mx-auto size-10 text-violet-300"/><h1 className="mt-4 text-2xl font-black text-white">Sign in to open Creator Studio</h1><p className="mt-2 text-sm text-slate-500">Your channel, content and analytics are private to your account.</p><Button onClick={startLogin} className="mt-5 bg-violet-500 hover:bg-violet-400">Sign in</Button></div></HkTubeShell>;

  return <HkTubeShell title="Creator Studio" subtitle="Your content, audience and performance in one workspace."><main className="mx-auto w-full max-w-[1400px] px-4 pb-16 sm:px-7 lg:px-9">
    <div className="mb-7 flex flex-col gap-4 border-b border-white/8 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-violet-300">Creator workspace</p><h1 className="mt-1 text-3xl font-black tracking-tight text-white">Build your HkTube presence.</h1><p className="mt-1.5 max-w-2xl text-sm text-slate-400">Viewer pages stay focused on watching. Studio keeps publishing and performance tools here.</p></div><div className="flex flex-wrap gap-2"><Link href="/settings" className="inline-flex min-h-11 items-center rounded-md border border-white/10 bg-white/[.03] px-4 text-sm font-bold text-white hover:bg-white/[.07]"><Settings2 className="mr-2 size-5"/>Settings</Link><Button onClick={() => void load()} variant="outline" className="min-h-11 border-white/10 bg-white/[.03] text-white"><RefreshCw className="mr-2 size-5"/>Refresh</Button><Link href="/upload" className="inline-flex items-center rounded-md bg-violet-500 px-4 text-sm font-bold text-white hover:bg-violet-400"><UploadCloud className="mr-2 size-4"/>Upload</Link></div></div>
    {channels.length > 0 && <div className="mb-6 flex gap-2 overflow-x-auto [scrollbar-width:none]">{channels.map(channel => <Link key={channel.id} href={`/channel/${channel.handle}`} className="flex shrink-0 items-center gap-2 rounded-full border border-white/8 bg-white/[.03] px-3 py-2 text-sm text-slate-300 hover:bg-white/[.07]"><span className="grid size-7 place-items-center overflow-hidden rounded-full bg-violet-500/20 text-xs font-bold text-white">{channel.avatar_url ? <img src={channel.avatar_url} alt="" className="size-full object-cover"/> : channel.name.slice(0, 1)}</span>{channel.name}</Link>)}</div>}
    <div className="mb-6 flex rounded-xl border border-white/8 bg-white/[.025] p-1 sm:w-fit"><button type="button" onClick={() => setTab("overview")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "overview" ? "bg-violet-500 text-white" : "text-slate-400 hover:text-white"}`}>Overview</button><button type="button" onClick={() => setTab("content")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "content" ? "bg-violet-500 text-white" : "text-slate-400 hover:text-white"}`}>Content</button></div>
    {loading ? <div className="grid min-h-[40vh] place-items-center"><Loader2 className="size-7 animate-spin text-violet-300"/></div> : tab === "overview" ? <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl border border-white/8 bg-white/[.025] p-5"><Users className="size-6 text-violet-300"/><p className="mt-5 text-2xl font-black text-white">{stat(followers)}</p><p className="mt-1 text-xs text-slate-500">Followers / subscribers</p></div><div className="rounded-2xl border border-white/8 bg-white/[.025] p-5"><BarChart3 className="size-6 text-cyan-300"/><p className="mt-5 text-2xl font-black text-white">{stat(totalViews)}</p><p className="mt-1 text-xs text-slate-500">Total video views</p></div><div className="rounded-2xl border border-white/8 bg-white/[.025] p-5"><Heart className="size-6 text-rose-300"/><p className="mt-5 text-2xl font-black text-white">{stat(totalLikes)}</p><p className="mt-1 text-xs text-slate-500">Total likes</p></div><div className="rounded-2xl border border-white/8 bg-white/[.025] p-5"><FileVideo2 className="size-6 text-emerald-300"/><p className="mt-5 text-2xl font-black text-white">{stat(published.length)}</p><p className="mt-1 text-xs text-slate-500">Published videos</p></div></div>
      <section><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-300">Content health</p><h2 className="mt-1 text-xl font-black text-white">Recent uploads</h2></div><button type="button" onClick={() => setTab("content")} className="text-sm font-bold text-violet-200">Manage content →</button></div>
        {recent.length ? <div className="grid gap-3">{recent.map(video => { const t = tone(video); const Icon = t.icon; return <Link key={video.id} href={`/watch/${video.id}`} className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[.02] p-3 transition hover:bg-white/[.05]"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/[.05]"><Video className="size-5 text-slate-400"/></span><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-white">{video.title}</span><span className="mt-1 block text-xs text-slate-500">{stat(video.views)} views · {stat(video.likes_count)} likes</span></span><span className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${t.className}`}><Icon className="size-3.5"/>{t.label}</span></Link>; })}</div> : <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center"><FileVideo2 className="mx-auto size-8 text-slate-600"/><p className="mt-3 font-semibold text-slate-300">No published content yet.</p><p className="mt-1 text-xs text-slate-600">Upload original content to start building your catalog.</p></div>}
      </section>
    </div> : <section className="overflow-hidden rounded-2xl border border-white/8 bg-white/[.02]"><div className="border-b border-white/8 px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-300">Content manager</p><h2 className="mt-1 text-xl font-black text-white">Your videos</h2></div>{videos.length ? <div className="divide-y divide-white/7">{videos.map(video => { const t = tone(video); const Icon = t.icon; return <div key={video.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="grid size-14 shrink-0 place-items-center rounded-xl bg-white/[.04]"><Video className="size-5 text-slate-500"/></div><div className="min-w-0 flex-1"><p className="truncate font-semibold text-white">{video.title}</p><p className="mt-1 text-xs text-slate-500">{stat(video.views)} views · {stat(video.likes_count)} likes · {video.visibility}</p></div><span className={`flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${t.className}`}><Icon className="size-3.5"/>{t.label}</span>{video.status === "published" && video.moderation_status === "approved" ? <Link href={`/watch/${video.id}`} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/[.06]">Open</Link> : null}</div>; })}</div> : <div className="p-10 text-center text-sm text-slate-500">No content found for this account.</div>}</section>}
  </main></HkTubeShell>;
}
