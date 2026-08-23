import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { BarChart3, Clapperboard, CircleUserRound, ImageOff, Plus, Settings, Upload } from "lucide-react";

export default function Profile() {
  const { user, loading } = useAuth();
  const channels = trpc.channels.mine.useQuery(undefined, { enabled: Boolean(user) });
  const dashboard = trpc.creator_studio.dashboard.useQuery(undefined, { enabled: Boolean(user) });
  if (loading) return <HkTubeShell title="Your channel"><div className="grid min-h-[55vh] place-items-center"><CircleUserRound className="size-8 animate-pulse text-violet-300" /></div></HkTubeShell>;
  if (!user) return <HkTubeShell title="Your channel"><section className="mx-auto max-w-md px-5 pt-12 text-center"><CircleUserRound className="mx-auto size-12 text-violet-200" /><h1 className="mt-4 text-2xl font-black text-white">Sign in to view your channel</h1><p className="mt-3 text-sm leading-6 text-slate-400">Your channel, videos and creator tools are available after signing in to your HkTube account.</p><Button onClick={startLogin} className="mt-6 rounded-full bg-violet-500 px-7 font-bold text-white">Sign in / Sign up</Button></section></HkTubeShell>;
  const channel = channels.data?.[0];
  const videos = dashboard.data?.videos ?? [];
  const ChannelActionIcon = channel ? Clapperboard : Plus;
  return <HkTubeShell title="Your channel" subtitle="Real channel records and published content only.">
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-5 sm:px-6 sm:py-8">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/20 via-[#141a2b] to-cyan-400/10">
        <div className="h-28 bg-gradient-to-r from-violet-500/30 via-fuchsia-400/15 to-cyan-300/20 sm:h-40" />
        <div className="px-5 pb-6 sm:px-8"><div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end"><div className="grid size-24 place-items-center rounded-full border-4 border-[#141a2b] bg-violet-500/40 text-3xl font-black text-white">{(channel?.displayName || user.name || "H").slice(0,1).toUpperCase()}</div><div className="min-w-0 flex-1"><h1 className="truncate text-2xl font-black text-white">{channel?.displayName || "No channel created yet"}</h1>{channel && <p className="mt-1 text-sm text-slate-400">@{channel.handle} · {channel.subscriberCount.toLocaleString()} subscribers</p>}</div><div className="flex flex-wrap gap-2"><Link href={channel ? "/studio" : "/channel/create"} className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950"><ChannelActionIcon className="mr-2 size-4" />{channel ? "Creator Studio" : "Create channel"}</Link><Link href="/settings" className="inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-white"><Settings className="mr-2 size-4" />Customize</Link></div></div>{channel?.description && <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-300">{channel.description}</p>}{!channel && <p className="mt-5 text-sm leading-6 text-slate-400">Create your first channel to publish videos and Shorts through the authorized upload workflow.</p>}</div>
      </section>
      {channel && <section className="grid gap-3 sm:grid-cols-3"><Metric label="Published content" value={String(videos.length)} icon={Clapperboard} /><Metric label="Total views" value={String(dashboard.data?.analytics.totalViews ?? 0)} icon={BarChart3} /><Metric label="Channel status" value={channel.verificationStatus} icon={CircleUserRound} /></section>}
      <section className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-black text-white">Your videos</h2><p className="mt-1 text-sm text-slate-400">Only content published by your authenticated account appears here.</p></div><Link href="/upload" className="inline-flex items-center rounded-full bg-violet-500 px-4 py-2 text-sm font-bold text-white"><Upload className="mr-2 size-4" />Upload</Link></div>{videos.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{videos.map(video => <article key={video.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/15"><div className="aspect-video bg-white/[.04]">{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt={video.title} className="size-full object-cover" /> : <div className="grid size-full place-items-center text-slate-600"><ImageOff /></div>}</div><div className="p-3"><h3 className="line-clamp-2 font-bold text-white">{video.title}</h3><p className="mt-1 text-xs text-slate-500">{video.viewCount.toLocaleString()} views · {video.category === "shorts" ? "Short" : "Video"}</p></div></article>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-10 text-center"><Clapperboard className="mx-auto size-8 text-violet-200" /><h3 className="mt-3 font-bold text-white">No published videos yet</h3><p className="mt-2 text-sm text-slate-500">Upload an authorized video or Short to make it appear here.</p></div>}</section>
    </div>
  </HkTubeShell>;
}
function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof BarChart3 }) { return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><Icon className="size-5 text-cyan-200" /><p className="mt-3 text-xl font-black text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>; }
