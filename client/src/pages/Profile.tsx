import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { BarChart3, Clapperboard, CircleUserRound, Edit3, ImageOff, Loader2, Play, Share2, Upload, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export default function Profile() {
  const { user, loading } = useAuth();
  const channels = trpc.channels.mine.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const dashboard = trpc.creator_studio.dashboard.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const recommendations = trpc.videos.latest.useQuery({ limit: 12 });
  const utils = trpc.useUtils();
  const [editOpen, setEditOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const updateChannel = trpc.channels.update.useMutation({
    onSuccess: async () => { setEditOpen(false); await Promise.all([channels.refetch(), utils.creator_studio.dashboard.invalidate()]); toast.success("Channel profile updated."); },
    onError: error => toast.error(error.message || "Could not update channel profile."),
  });
  const channel = channels.data?.[0];
  useEffect(() => {
    if (!channel) return;
    setDisplayName(channel.displayName);
    setDescription(channel.description || "");
    setAvatarUrl(channel.avatarUrl || user?.avatarUrl || "");
    setBannerUrl(channel.bannerUrl || "");
  }, [channel?.id, channel?.displayName, channel?.description, channel?.avatarUrl, channel?.bannerUrl, user?.avatarUrl]);

  if (loading) return <HkTubeShell title="Profile"><div className="grid min-h-[55vh] place-items-center"><CircleUserRound className="size-8 animate-pulse text-violet-300" /></div></HkTubeShell>;
  if (!user) return <HkTubeShell title="Profile"><section className="mx-auto max-w-md px-5 pt-12 text-center"><CircleUserRound className="mx-auto size-12 text-violet-200" /><h1 className="mt-4 text-2xl font-black text-white">Sign in to view your profile</h1><p className="mt-3 text-sm leading-6 text-slate-400">Your profile, channel and published content are available after signing in.</p><Button onClick={startLogin} className="mt-6 rounded-full bg-violet-500 px-7 font-bold text-white">Sign in / Sign up</Button></section></HkTubeShell>;

  const videos = dashboard.data?.videos ?? [];
  const longVideos = videos.filter(video => video.category === "regular");
  const clips = videos.filter(video => video.category === "shorts");
  const recommended = (recommendations.data ?? []).filter(video => !videos.some(own => own.id === video.id)).slice(0, 8);
  async function shareChannel() {
    const url = channel ? `${window.location.origin}/channel/${channel.handle}` : window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: channel?.displayName || "HkTube profile", url });
      else { await navigator.clipboard.writeText(url); toast.success("Profile link copied."); }
    } catch (error) {
      if ((error as DOMException | undefined)?.name !== "AbortError") toast.error("Unable to share this profile.");
    }
  }
  function openEditor() {
    if (!channel) return;
    setDisplayName(channel.displayName);
    setDescription(channel.description || "");
    setAvatarUrl(channel.avatarUrl || user.avatarUrl || "");
    setBannerUrl(channel.bannerUrl || "");
    setEditOpen(true);
  }
  function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!channel) return;
    updateChannel.mutate({ id: channel.id, displayName, description, avatarUrl: avatarUrl || null, bannerUrl: bannerUrl || null });
  }
  const VideoGrid = ({ items, title, empty, shorts = false }: { items: typeof videos; title: string; empty: string; shorts?: boolean }) => <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5 sm:p-7"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-300/70">Channel</p><h2 className="mt-1 text-xl font-black text-white">{title}</h2></div>{items.length > 0 && <Link href="/studio" className="text-xs font-bold text-violet-200">Manage</Link>}</div>{items.length ? <div className={shorts ? "mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" : "mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"}>{items.map(video => <Link key={video.id} href={`/watch/${video.id}`} className="group overflow-hidden rounded-2xl border border-white/10 bg-black/15"><div className={`relative bg-white/[.04] ${shorts ? "aspect-[9/16]" : "aspect-video"}`}>{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="size-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" /> : <div className="grid size-full place-items-center text-slate-600"><ImageOff /></div>}{shorts && <span className="absolute bottom-2 left-2 rounded-full bg-black/75 px-2 py-1 text-[10px] font-bold text-white">Clip</span>}</div><div className="p-3"><h3 className="line-clamp-2 text-sm font-bold text-white">{video.title}</h3><p className="mt-1 text-xs text-slate-500">{video.viewCount.toLocaleString()} views</p></div></Link>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-8 text-center"><Play className="mx-auto size-7 text-slate-600" /><p className="mt-3 text-sm text-slate-500">{empty}</p></div>}</section>;
  return <HkTubeShell title="Profile" subtitle="Your YouTube-style channel home for videos, Clips and recommendations.">
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-5 pb-28 sm:px-6 sm:py-8">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#111624]">
        <div className="relative h-36 bg-gradient-to-r from-violet-500/35 via-fuchsia-400/15 to-cyan-300/20 sm:h-56">{channel?.bannerUrl && <img src={channel.bannerUrl} alt="" className="size-full object-cover" />}</div>
        <div className="px-5 pb-6 sm:px-8"><div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end"><div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-[#111624] bg-violet-500/40 text-3xl font-black text-white">{channel?.avatarUrl || user.avatarUrl ? <img src={channel?.avatarUrl || user.avatarUrl || ""} alt="" className="size-full object-cover" /> : (channel?.displayName || user.name || "H").slice(0,1).toUpperCase()}</div><div className="min-w-0 flex-1"><h1 className="truncate text-2xl font-black text-white">{channel?.displayName || user.name || "HkTube Creator"}</h1>{channel && <p className="mt-1 text-sm text-slate-400">@{channel.handle} · {channel.subscriberCount.toLocaleString()} subscribers</p>}<p className="mt-1 text-xs text-slate-500">{user.email || "HkTube member"}</p></div><div className="flex flex-wrap gap-2"><Button type="button" onClick={openEditor} disabled={!channel} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-100"><Edit3 className="mr-2 size-4" />Edit profile</Button><Button type="button" onClick={() => void shareChannel()} variant="outline" className="rounded-full border-white/15 text-white hover:bg-white/10"><Share2 className="mr-2 size-4" />Share</Button><Link href="/studio" className="inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-white"><Clapperboard className="mr-2 size-4" />Studio</Link></div></div><p className="mt-5 max-w-3xl text-sm leading-6 text-slate-300">{channel?.description || "Add a description to tell viewers what your channel makes."}</p></div>
      </section>
      {!channel && channels.isLoading && <section className="rounded-2xl border border-violet-300/15 bg-violet-500/[.06] p-4 text-sm text-slate-300"><Loader2 className="mr-2 inline size-4 animate-spin" />Preparing your creator profile…</section>}
      {!channel && !channels.isLoading && !channels.isError && <section className="rounded-2xl border border-violet-300/15 bg-violet-500/[.06] p-4 text-sm text-slate-300">Your creator profile is being prepared. Refreshing channel data…</section>}
      {channel && <section className="grid gap-3 sm:grid-cols-3"><Metric label="Subscribers" value={channel.subscriberCount.toLocaleString()} icon={UsersRound} /><Metric label="Total views" value={String(dashboard.data?.analytics.totalViews ?? 0)} icon={BarChart3} /><Metric label="Published" value={String(videos.length)} icon={Clapperboard} /></section>}
      <VideoGrid items={longVideos} title="Videos" empty="Your published long videos will appear here." />
      <VideoGrid items={clips} title="Clips" empty="Your short vertical Clips will appear here." shorts />
      <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5 sm:p-7"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-200/70">Recommended</p><h2 className="mt-1 text-xl font-black text-white">Recommended videos</h2><p className="mt-1 text-sm text-slate-500">Fresh videos from HkTube, separate from your own uploads.</p></div>{recommended.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{recommended.map(video => <Link key={video.id} href={`/watch/${video.id}`} className="group overflow-hidden rounded-2xl border border-white/10 bg-black/15"><div className="aspect-video bg-white/[.04]">{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="size-full object-cover transition group-hover:scale-[1.02]" loading="lazy" /> : <div className="grid size-full place-items-center text-slate-600"><ImageOff /></div>}</div><div className="p-3"><h3 className="line-clamp-2 text-sm font-bold text-white">{video.title}</h3><p className="mt-1 text-xs text-slate-500">{video.viewCount.toLocaleString()} views</p></div></Link>)}</div> : <p className="mt-5 text-sm text-slate-500">More recommendations will appear as HkTube gets published videos.</p>}</section>
      <section className="rounded-2xl border border-white/10 bg-white/[.02] p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-black text-white">Publish something new</h2><p className="mt-1 text-sm text-slate-500">Upload a long video or vertical Clip.</p></div><Link href="/upload" className="inline-flex items-center rounded-full bg-violet-500 px-4 py-2 text-sm font-bold text-white"><Upload className="mr-2 size-4" />Upload</Link></div></section>
    </div>
    <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto border-white/10 bg-[#141925] text-white"><DialogHeader><DialogTitle>Edit channel profile</DialogTitle><DialogDescription className="text-slate-400">Update the identity viewers see on your HkTube channel.</DialogDescription></DialogHeader><form onSubmit={saveProfile} className="space-y-4"><div><label className="text-xs font-bold text-slate-300">Display name</label><Input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={255} className="mt-1 border-white/10 bg-black/20 text-white" required /></div><div><label className="text-xs font-bold text-slate-300">Description</label><Textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={5000} rows={5} className="mt-1 border-white/10 bg-black/20 text-white" placeholder="Tell viewers about your channel" /></div><div><label className="text-xs font-bold text-slate-300">Avatar image URL</label><Input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} className="mt-1 border-white/10 bg-black/20 text-white" placeholder="https://…" type="url" /></div><div><label className="text-xs font-bold text-slate-300">Banner image URL</label><Input value={bannerUrl} onChange={e => setBannerUrl(e.target.value)} className="mt-1 border-white/10 bg-black/20 text-white" placeholder="https://…" type="url" /></div><div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="border-white/10 text-white"><X className="mr-2 size-4" />Cancel</Button><Button type="submit" disabled={updateChannel.isPending} className="bg-violet-500 text-white">{updateChannel.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Save changes</Button></div></form></DialogContent></Dialog>
  </HkTubeShell>;
}
function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof BarChart3 }) { return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><Icon className="size-5 text-cyan-200" /><p className="mt-3 text-xl font-black text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>; }
