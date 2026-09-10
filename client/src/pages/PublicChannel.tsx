import { EmptyVideos, VideoCard } from "@/components/VideoCard";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { ChannelBadge } from "@/components/ChannelBadge";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { VideoRecord } from "@/lib/video";
import { trpc } from "@/lib/trpc";
import { BarChart3, Clapperboard, Loader2, Share2, UsersRound } from "lucide-react";
import { useRoute } from "wouter";
import { toast } from "sonner";

export default function PublicChannel() {
  const [, params] = useRoute("/channel/:handle");
  const handle = params?.handle || "";
  const { user } = useAuth();
  const channelQuery = trpc.channels.public.useQuery({ handle }, { enabled: Boolean(handle) });
  const subscribe = trpc.subscriptions.toggle.useMutation({ onSuccess: () => void channelQuery.refetch(), onError: error => toast.error(error.message) });
  const data = channelQuery.data;
  const channel = data?.channel;
  const videos = (data?.videos ?? []) as VideoRecord[];

  async function shareChannel() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: channel?.displayName || "HkTube channel", url });
      else { await navigator.clipboard.writeText(url); toast.success("Channel link copied."); }
    } catch (error) { if ((error as DOMException | undefined)?.name !== "AbortError") toast.error("Unable to share this channel."); }
  }

  if (channelQuery.isLoading) return <HkTubeShell><div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-7 animate-spin text-fuchsia-300" aria-label="Loading channel" /></div></HkTubeShell>;
  if (channelQuery.isError || !data || !channel) return <HkTubeShell title="Channel unavailable"><EmptyVideos title="This channel is not available" copy="The public channel handle may be incorrect or the channel has not been published." icon={UsersRound} /></HkTubeShell>;

  return <HkTubeShell title={channel.displayName} subtitle={`@${channel.handle}`}>
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-5 sm:px-6 sm:py-8">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/20 via-[#141a2b] to-cyan-400/10">
        <div className="h-32 bg-gradient-to-r from-violet-500/35 via-fuchsia-400/15 to-cyan-300/20 sm:h-48">{channel.bannerUrl && <img src={channel.bannerUrl} alt="" className="size-full object-cover opacity-80" />}</div>
        <div className="px-5 pb-6 sm:px-8"><div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end"><div className="grid size-24 place-items-center rounded-full border-4 border-[#141a2b] bg-violet-500/40 text-3xl font-black text-white">{channel.avatarUrl ? <img src={channel.avatarUrl} alt="" className="size-full rounded-full object-cover" /> : channel.displayName.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-2xl font-black text-white">{channel.displayName}</h1><ChannelBadge subscriberCount={channel.subscriberCount} verified={channel.verificationStatus === "verified"} /></div><p className="mt-1 text-sm text-slate-400">@{channel.handle} · {channel.subscriberCount.toLocaleString()} subscribers</p></div><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => user ? subscribe.mutate({ channelId: channel.id }) : startLogin()} disabled={subscribe.isPending} className={data.subscribed ? "rounded-full bg-white text-slate-950 hover:bg-slate-100" : "rounded-full bg-violet-500 text-white hover:bg-violet-400"}>{data.subscribed ? "Subscribed" : "Subscribe"}</Button><Button type="button" variant="outline" onClick={() => void shareChannel()} className="rounded-full border-white/15 text-white hover:bg-white/10"><Share2 className="mr-2 size-4" />Share</Button></div></div>{channel.description && <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-300">{channel.description}</p>}</div>
      </section>
      <section className="grid gap-3 sm:grid-cols-3"><Metric icon={Clapperboard} label="Published content" value={videos.length.toLocaleString()} /><Metric icon={BarChart3} label="Total views" value={data.totalViews.toLocaleString()} /><Metric icon={UsersRound} label="Subscribers" value={channel.subscriberCount.toLocaleString()} /></section>
      <section><div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-200">Channel library</p><h2 className="mt-1 text-2xl font-black text-white">Latest videos</h2></div></div>{videos.length ? <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">{videos.map(video => <VideoCard key={video.id} video={video} />)}</div> : <EmptyVideos title="No published videos yet" copy="This creator has not published real content to the channel yet." icon={Clapperboard} />}</section>
    </div>
  </HkTubeShell>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><Icon className="size-5 text-cyan-200" /><p className="mt-3 text-xl font-black text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>; }
