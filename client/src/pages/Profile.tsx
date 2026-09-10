import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { BarChart3, Clapperboard, CircleUserRound, ImageOff, Play, Share2, Settings, Upload, UsersRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useRef } from "react";

export default function Profile() {
  const { user, loading } = useAuth();
  const channels = trpc.channels.mine.useQuery(undefined, { enabled: Boolean(user) });
  const dashboard = trpc.creator_studio.dashboard.useQuery(undefined, { enabled: Boolean(user) });
  const utils = trpc.useUtils();
  const provisioned = useRef(false);
  const createChannel = trpc.channels.create.useMutation({
    onSuccess: async () => {
      provisioned.current = true;
      await Promise.all([channels.refetch(), utils.creator_studio.dashboard.invalidate()]);
      toast.success("Your HkTube creator profile is ready.");
    },
    onError: error => {
      provisioned.current = false;
      if (!/already exists|duplicate|unique/i.test(error.message)) toast.error(error.message || "Could not create your creator profile.");
    },
  });

  const suggestedHandle = useMemo(() => {
    const base = (user?.name || "creator").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 48) || "creator";
    const id = user?.id ? String(user.id) : "";
    return `${base}_${id}`.slice(0, 64).replace(/_+$/, "") || "creator_hktube";
  }, [user?.name, user?.id]);

  useEffect(() => {
    if (!user || loading || channels.isLoading || channels.isError || channels.data?.length || provisioned.current || createChannel.isPending) return;
    provisioned.current = true;
    createChannel.mutate({ handle: suggestedHandle, displayName: user.name?.trim() || "HkTube Creator", description: "" });
  }, [user, loading, channels.isLoading, channels.isError, channels.data, createChannel.isPending, suggestedHandle]);

  if (loading) return <HkTubeShell title="Profile"><div className="grid min-h-[55vh] place-items-center"><CircleUserRound className="size-8 animate-pulse text-violet-300" /></div></HkTubeShell>;
  if (!user) return <HkTubeShell title="Profile"><section className="mx-auto max-w-md px-5 pt-12 text-center"><CircleUserRound className="mx-auto size-12 text-violet-200" /><h1 className="mt-4 text-2xl font-black text-white">Sign in to view your profile</h1><p className="mt-3 text-sm leading-6 text-slate-400">Your profile, channel and published content are available after signing in.</p><Button onClick={startLogin} className="mt-6 rounded-full bg-violet-500 px-7 font-bold text-white">Sign in / Sign up</Button></section></HkTubeShell>;
  const channel = channels.data?.[0];
  const videos = dashboard.data?.videos ?? [];
  const longVideos = videos.filter(video => video.category === "regular");
  const clips = videos.filter(video => video.category === "shorts");
  async function shareChannel() {
    const url = window.location.href;
    try { if (navigator.share) await navigator.share({ title: channel?.displayName || "My HkTube profile", url }); else { await navigator.clipboard.writeText(url); toast.success("Profile link copied."); } }
    catch (error) { if ((error as DOMException | undefined)?.name !== "AbortError") toast.error("Unable to share this profile."); }
  }
  const VideoRow = ({ items, title, empty }: { items: typeof videos; title: string; empty: string }) => <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5 sm:p-7"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-300/70">Channel content</p><h2 className="mt-1 text-xl font-black text-white">{title}</h2></div>{items.length > 0 && <Link href="/studio" className="text-xs font-bold text-violet-200 hover:text-white">Manage</Link>}</div>{items.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{items.map(video => <Link key={video.id} href={`/watch/${video.id}`} className="group overflow-hidden rounded-2xl border border-white/10 bg-black/15"><div className="relative aspect-video bg-white/[.04]">{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="size-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" /> : <div className="grid size-full place-items-center text-slate-600"><ImageOff /></div>}{video.category === "shorts" && <span className="absolute bottom-2 left-2 rounded-full bg-black/75 px-2 py-1 text-[10px] font-bold text-white">Clip</span>}</div><div className="p-3"><h3 className="line-clamp-2 text-sm font-bold text-white">{video.title}</h3><p className="mt-1 text-xs text-slate-500">{video.viewCount.toLocaleString()} views</p></div></Link>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-8 text-center"><Play className="mx-auto size-7 text-slate-600" /><p className="mt-3 text-sm text-slate-500">{empty}</p></div>}</section>;

  return <HkTubeShell title="Profile" subtitle="Your public identity, channel and content in one place.">
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-5 sm:px-6 sm:py-8">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#111624]">
        <div className="relative h-32 bg-gradient-to-r from-violet-500/35 via-fuchsia-400/15 to-cyan-300/20 sm:h-48">{channel?.bannerUrl && <img src={channel.bannerUrl} alt="" className="size-full object-cover opacity-90" />}</div>
        <div className="px-5 pb-6 sm:px-8"><div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end"><div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-[#111624] bg-violet-500/40 text-3xl font-black text-white">{channel?.avatarUrl || user.avatarUrl ? <img src={channel?.avatarUrl || user.avatarUrl || ""} alt="" className="size-full object-cover" /> : (channel?.displayName || user.name || "H").slice(0,1).toUpperCase()}</div><div className="min-w-0 flex-1"><h1 className="truncate text-2xl font-black text-white">{channel?.displayName || user.name || "HkTube Creator"}</h1>{channel && <p className="mt-1 text-sm text-slate-400">@{channel.handle} · {channel.subscriberCount.toLocaleString()} subscribers</p>}<p className="mt-1 text-xs text-slate-500">{user.email || "HkTube member"}</p></div><div className="flex flex-wrap gap-2"><Link href="/studio" className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950"><Clapperboard className="mr-2 size-4" />Creator Studio</Link><Button type="button" onClick={() => void shareChannel()} variant="outline" className="rounded-full border-white/15 text-white hover:bg-white/10"><Share2 className="mr-2 size-4" />Share</Button><Link href="/settings" className="inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-white"><Settings className="mr-2 size-4" />Edit profile</Link></div></div><p className="mt-5 max-w-3xl text-sm leading-6 text-slate-300">{channel?.description || "Add a channel description from your creator settings to tell viewers what you make."}</p></div>
      </section>

      {!channel && (channels.isLoading || createChannel.isPending) && <section className="rounded-2xl border border-violet-300/15 bg-violet-500/[.06] p-4 text-sm text-slate-300"><Loader2 className="mr-2 inline size-4 animate-spin" />Preparing your creator profile…</section>}
      {channel && <section className="grid gap-3 sm:grid-cols-3"><Metric label="Subscribers" value={channel.subscriberCount.toLocaleString()} icon={UsersRound} /><Metric label="Total views" value={String(dashboard.data?.analytics.totalViews ?? 0)} icon={BarChart3} /><Metric label="Published" value={String(videos.length)} icon={Clapperboard} /></section>}

      <section className="rounded-3xl border border-violet-300/15 bg-gradient-to-r from-violet-500/[.08] to-cyan-400/[.04] p-5 sm:p-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-200/70">Creator profile</p><h2 className="mt-1 text-xl font-black text-white">Build your channel identity</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Your profile is the public home for your long videos and Clips. Channel banner, avatar and description are supported by the channel data model and can be managed from creator tools.</p></div><Link href="/studio/settings" className="inline-flex shrink-0 items-center rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-950">Customize channel</Link></div></section>

      <VideoRow items={longVideos} title="Videos" empty="Your published long videos will appear here." />
      <VideoRow items={clips} title="Clips" empty="Your published Clips will appear here as a separate short-video shelf." />

      <section className="rounded-2xl border border-white/10 bg-white/[.02] p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-black text-white">Publish something new</h2><p className="mt-1 text-sm text-slate-500">Upload a long video or a vertical Clip without leaving your profile.</p></div><Link href="/upload" className="inline-flex items-center rounded-full bg-violet-500 px-4 py-2 text-sm font-bold text-white"><Upload className="mr-2 size-4" />Upload</Link></div></section>
    </div>
  </HkTubeShell>;
}
function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof BarChart3 }) { return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><Icon className="size-5 text-cyan-200" /><p className="mt-3 text-xl font-black text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>; }
