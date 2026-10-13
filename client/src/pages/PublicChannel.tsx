import { EmptyVideos, VideoCard } from "@/components/VideoCard";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { ChannelBadge } from "@/components/ChannelBadge";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { VideoRecord } from "@/lib/video";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  Clapperboard,
  Loader2,
  Play,
  Share2,
  UsersRound,
} from "lucide-react";
import { useRoute } from "wouter";
import { toast } from "sonner";
import { useState } from "react";

type ChannelTab = "videos" | "clips";

export default function PublicChannel() {
  const [, params] = useRoute("/channel/:handle");
  const handle = params?.handle || "";
  const { user } = useAuth();
  const [tab, setTab] = useState<ChannelTab>("videos");
  const channelQuery = trpc.channels.public.useQuery(
    { handle },
    { enabled: Boolean(handle) }
  );
  const subscribe = trpc.subscriptions.toggle.useMutation({
    onSuccess: () => void channelQuery.refetch(),
    onError: error => toast.error(error.message),
  });
  const data = channelQuery.data;
  const channel = data?.channel;
  const videos = (data?.videos ?? []) as VideoRecord[];
  const longVideos = videos.filter(video => video.category !== "shorts");
  const clips = videos.filter(video => video.category === "shorts");
  const shownVideos = tab === "clips" ? clips : longVideos;

  async function shareChannel() {
    const url = window.location.href;
    try {
      if (navigator.share)
        await navigator.share({
          title: channel?.displayName || "HkTube channel",
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Channel link copied.");
      }
    } catch (error) {
      if ((error as DOMException | undefined)?.name !== "AbortError")
        toast.error("Unable to share this channel.");
    }
  }

  if (channelQuery.isLoading)
    return (
      <HkTubeShell>
        <div className="grid min-h-[55vh] place-items-center">
          <Loader2
            className="size-7 animate-spin text-fuchsia-300"
            aria-label="Loading channel"
          />
        </div>
      </HkTubeShell>
    );
  if (channelQuery.isError || !data || !channel)
    return (
      <HkTubeShell title="Channel unavailable">
        <EmptyVideos
          title="This channel is not available"
          copy="The public channel handle may be incorrect or the channel has not been published."
          icon={UsersRound}
        />
      </HkTubeShell>
    );

  return (
    <HkTubeShell title={channel.displayName} subtitle={`@${channel.handle}`}>
      <div className="mx-auto w-full max-w-6xl space-y-4 px-3 py-3 sm:px-6 sm:py-8">
        <section className="rounded-3xl border border-white/10 bg-[#111522] p-5 sm:p-8">
          <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 sm:flex sm:items-center sm:gap-5">
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/10 bg-violet-500/30 text-2xl font-black text-white sm:size-28 sm:text-3xl">
              {channel.avatarUrl ? (
                <img
                  src={channel.avatarUrl}
                  alt={`${channel.displayName} channel logo`}
                  className="size-full object-cover"
                />
              ) : (
                channel.displayName.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-black text-white sm:text-3xl">
                  {channel.displayName}
                </h1>
                <ChannelBadge
                  subscriberCount={channel.subscriberCount}
                  verified={channel.verificationStatus === "verified"}
                />
              </div>
              <p className="mt-1 text-sm text-slate-400">
                @{channel.handle} · {channel.subscriberCount.toLocaleString()}{" "}
                subscribers
              </p>
              {channel.description && (
                <p className="mt-2 line-clamp-2 max-w-2xl text-xs leading-5 text-slate-300 sm:mt-3 sm:text-sm sm:leading-6">
                  {channel.description}
                </p>
              )}
            </div>
            <div className="col-span-full flex flex-wrap gap-2 sm:ml-auto sm:justify-end">
              <Button
                type="button"
                onClick={() =>
                  user
                    ? subscribe.mutate({ channelId: channel.id })
                    : startLogin()
                }
                disabled={subscribe.isPending}
                className={
                  data.subscribed
                    ? "rounded-full bg-white text-slate-950 hover:bg-slate-100"
                    : "rounded-full bg-violet-500 text-white hover:bg-violet-400"
                }
              >
                {data.subscribed ? "Subscribed" : "Subscribe"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void shareChannel()}
                className="rounded-full border-white/15 text-white hover:bg-white/10"
              >
                <Share2 className="mr-2 size-4" />
                Share
              </Button>
            </div>
          </div>
        </section>
        <section className="grid grid-cols-3 gap-2 sm:gap-3">
          <Metric
            icon={Clapperboard}
            label="Published content"
            value={videos.length.toLocaleString()}
          />
          <Metric
            icon={BarChart3}
            label="Total views"
            value={data.totalViews.toLocaleString()}
          />
          <Metric
            icon={UsersRound}
            label="Subscribers"
            value={channel.subscriberCount.toLocaleString()}
          />
        </section>
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#111522]">
          <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-3 pt-2 [scrollbar-width:none]">
            {(
              [
                ["videos", "Long Videos", Play],
                ["clips", "Clips", Clapperboard],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition ${tab === id ? "border-violet-400 text-white" : "border-transparent text-slate-500 hover:text-slate-200"}`}
              >
                <Icon className="size-4" />
                {label}
                <span className="text-xs opacity-65">
                  {id === "clips" ? clips.length : longVideos.length}
                </span>
              </button>
            ))}
          </div>
          <div className="p-4 sm:p-6">
            {shownVideos.length ? (
              <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                {shownVideos.map(video => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            ) : (
              <EmptyVideos
                title={
                  tab === "clips"
                    ? "No clips published yet"
                    : "No long videos published yet"
                }
                copy={
                  tab === "clips"
                    ? "Clips published by this creator will appear here."
                    : "Long videos published by this creator will appear here."
                }
                icon={tab === "clips" ? Clapperboard : Play}
              />
            )}
          </div>
        </section>
      </div>
    </HkTubeShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[.025] p-3 sm:p-4">
      <Icon className="size-5 text-cyan-200" />
      <p className="mt-2 truncate text-lg font-black text-white sm:mt-3 sm:text-xl">{value}</p>
      <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500 sm:text-xs">{label}</p>
    </div>
  );
}
