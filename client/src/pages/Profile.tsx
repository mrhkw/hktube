import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { HkTubeShell } from "@/components/HkTubeShell";
import { UploadProgressCard, useUploadJobs } from "@/components/create/UploadProgressCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  listMySupabaseChannels,
  updateSupabaseChannel,
  type SupabaseChannel,
} from "@/lib/supabaseChannels";
import { listMySupabaseVideos, type SupabaseVideo } from "@/lib/supabaseVideos";
import { supabase } from "@/lib/supabase";
import { Link, useLocation } from "wouter";
import {
  Bookmark,
  CircleUserRound,
  Edit3,
  FileText,
  ImageOff,
  Loader2,
  Play,
  Settings2,
  Share2,
  X,
  ListVideo,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

type ProfileTab = "videos" | "clips" | "posts" | "favorites";

/**
 * Uploads that are preparing, sending or just finished, shown on the channel the
 * way the YouTube app shows them there.
 */
function UploadsInProgress() {
  const jobs = useUploadJobs();
  if (jobs.length === 0) return null;
  return (
    <section className="mb-5 space-y-3" aria-label="Uploads">
      {jobs.slice(0, 3).map(job => (
        <UploadProgressCard key={job.id} job={job} />
      ))}
    </section>
  );
}

export default function Profile() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [channel, setChannel] = useState<SupabaseChannel | null>(null);
  const [videos, setVideos] = useState<SupabaseVideo[]>([]);
  const [favorites, setFavorites] = useState<SupabaseVideo[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [tab, setTab] = useState<ProfileTab>("videos");

  async function loadProfile() {
    if (!user) return;
    setDataLoading(true);
    try {
      const [channels, ownVideos] = await Promise.all([
        listMySupabaseChannels(),
        listMySupabaseVideos(String(user.id)),
      ]);
      setChannel(channels[0] ?? null);
      setVideos(ownVideos);
      const { data: saves } = await supabase
        .from("saves")
        .select("video_id,created_at")
        .eq("user_id", user.id)
        .not("video_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);
      const ids = (saves ?? []).map(row => String(row.video_id));
      if (ids.length) {
        const { data: savedRows } = await supabase
          .from("videos")
          .select(
            "id,creator_id,channel_id,title,description,video_path,thumbnail_path,duration_seconds,views,published_at,created_at,status,moderation_status"
          )
          .in("id", ids)
          .eq("visibility", "public")
          .eq("status", "published")
          .eq("moderation_status", "approved");
        const byId = new Map(
          (savedRows ?? []).map(row => [String(row.id), row])
        );
        setFavorites(
          ids
            .map(id => byId.get(id))
            .filter(Boolean)
            .map(row => ({
              id: String(row!.id),
              creatorId: String(row!.creator_id),
              channelId: String(row!.channel_id),
              title: String(row!.title),
              description: row!.description ?? null,
              videoUrl: row!.video_path
                ? supabase.storage.from("videos").getPublicUrl(row!.video_path)
                    .data.publicUrl
                : "",
              thumbnailUrl: row!.thumbnail_path
                ? supabase.storage
                    .from("thumbnails")
                    .getPublicUrl(row!.thumbnail_path).data.publicUrl
                : null,
              durationSeconds: Number(row!.duration_seconds ?? 0),
              viewCount: Number(row!.views ?? 0),
              publishedAt: row!.published_at ?? null,
              createdAt: row!.created_at,
              status: row!.status,
              moderationStatus: row!.moderation_status,
            })) as SupabaseVideo[]
        );
      } else setFavorites([]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load your profile."
      );
    } finally {
      setDataLoading(false);
    }
  }
  useEffect(() => {
    if (user) void loadProfile();
    else setDataLoading(false);
  }, [user?.id]);
  async function shareChannel() {
    const url = channel
      ? `${window.location.origin}/channel/${channel.handle}`
      : window.location.href;
    try {
      if (navigator.share)
        await navigator.share({
          title: channel?.displayName || "HkTube profile",
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Profile link copied.");
      }
    } catch {
      /* cancelled */
    }
  }

  const visibleVideos =
    tab === "clips"
      ? videos.filter(video => video.isShort || video.tags.includes("shorts"))
      : tab === "videos"
        ? videos.filter(
            video => !video.isShort && !video.tags.includes("shorts")
          )
        : tab === "favorites"
          ? favorites
          : videos;

  if (loading)
    return (
      <HkTubeShell
        title="Profile"
        headerAvatarUrl={channel?.avatarUrl || user?.avatarUrl}
      >
        <div className="grid min-h-[55vh] place-items-center">
          <Loader2 className="size-8 animate-spin text-violet-400" />
        </div>
      </HkTubeShell>
    );
  if (!user)
    return (
      <HkTubeShell
        title="Profile"
        headerAvatarUrl={channel?.avatarUrl}
      >
        <section className="mx-auto max-w-md px-5 pt-12 text-center">
          <CircleUserRound className="mx-auto size-12 text-violet-400" />
          <h1 className="mt-4 text-2xl font-black text-white">
            Sign in to view your profile
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Your channel, videos, favorites and settings live here.
          </p>
          <Button
            onClick={startLogin}
            className="mt-6 rounded-full bg-violet-600 px-7 font-bold text-white"
          >
            Sign in / Sign up
          </Button>
        </section>
      </HkTubeShell>
    );

  return (
    <HkTubeShell
      title={channel?.displayName || user.name || "Profile"}
      headerAvatarUrl={channel?.avatarUrl || user?.avatarUrl}
    >
      <div className="mx-auto max-w-6xl px-3 py-3 pb-28 sm:px-6 sm:py-7">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#111522] shadow-xl shadow-black/10">
          <div className="relative h-36 overflow-hidden bg-gradient-to-r from-violet-900 via-[#252b4b] to-fuchsia-900 sm:h-52">
            {channel?.bannerUrl ? (
              <img
                src={channel.bannerUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,.65),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(217,70,239,.4),transparent_38%)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#111522]/80 to-transparent" />
          </div>
          <div className="px-4 pb-6 sm:px-8">
            <div className="relative -mt-10 flex flex-wrap items-end gap-4 sm:-mt-14">
              <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-[#111522] bg-violet-600 text-3xl font-black text-white shadow-xl sm:size-32">
                {channel?.avatarUrl || user?.avatarUrl ? (
                  <img
                    src={channel?.avatarUrl || user?.avatarUrl || ""}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  (channel?.displayName || user.name || "H")
                    .slice(0, 1)
                    .toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <h1 className="truncate text-2xl font-black text-white sm:text-3xl">
                  {channel?.displayName || user.name || "HkTube Creator"}
                </h1>
                <p className="mt-0.5 text-sm text-slate-400">
                  @{channel?.handle || "creator"}
                </p>
                <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-400">
                  {channel?.description ||
                    "Add a channel description to tell viewers what you create."}
                </p>
              </div>
              <div className="flex gap-2 pb-1">
                <Link
                  href="/channel/edit"
                  aria-disabled={!channel}
                  className={
                    "inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-bold text-black transition " +
                    (channel ? "hover:bg-white/90" : "pointer-events-none opacity-50")
                  }
                >
                  <Edit3 className="mr-1.5 size-4" />
                  Edit channel
                </Link>
                <Button
                  type="button"
                  onClick={() => void shareChannel()}
                  variant="outline"
                  className="rounded-full border-white/10 bg-white/[.04] text-white"
                >
                  <Share2 className="mr-1.5 size-4" />
                  Share
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-[#111522]">
          <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-2 pt-2 [scrollbar-width:none]">
            {(
              [
                ["videos", "Long Videos", Play],
                ["clips", "Clips", ClapperboardIcon],
                ["posts", "Posts", FileText],
                ["favorites", "Favorites", Bookmark],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cnTab(tab === id)}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
          <div className="p-4 sm:p-6">
            {dataLoading ? (
              <div className="grid min-h-40 place-items-center">
                <Loader2 className="size-7 animate-spin text-violet-500" />
              </div>
            ) : tab === "posts" ? (
              <EmptyState
                icon={FileText}
                title="Your posts"
                text="Published community posts will appear here."
                href="/posts"
                button="Open Posts"
              />
            ) : tab === "favorites" && !favorites.length ? (
              <EmptyState
                icon={Bookmark}
                title="No favorites yet"
                text="Use Save on a video or Short to keep it here."
                href="/library"
                button="Open Library"
              />
            ) : visibleVideos.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {visibleVideos.map(video => (
                  <ProfileVideoCard key={video.id} video={video} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
                <ListVideo className="mx-auto size-8 text-slate-500" />
                <p className="mt-3 text-sm text-slate-500">
                  No{" "}
                  {tab === "clips"
                    ? "clips"
                    : tab === "favorites"
                      ? "favorites"
                      : "long videos"}{" "}
                  yet.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

    </HkTubeShell>
  );
}

function ProfileVideoCard({ video }: { video: SupabaseVideo }) {
  const approved =
    video.status === "published" && video.moderationStatus === "approved";
  const card = (
    <div className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[.03]">
      <div className="relative aspect-video bg-slate-950">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt=""
            className="size-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="grid size-full place-items-center text-slate-500">
            <ImageOff />
          </div>
        )}
        {!approved && (
          <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-1 text-[10px] font-black text-black">
            Pending review
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-bold text-white">
          {video.title}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {video.viewCount.toLocaleString()} views ·{" "}
          {approved ? "Published" : "Not public yet"}
        </p>
      </div>
    </div>
  );
  return approved ? <Link href={`/watch/${video.id}`}>{card}</Link> : card;
}
function EmptyState({
  icon: Icon,
  title,
  text,
  href,
  button,
}: {
  icon: typeof Bookmark;
  title: string;
  text: string;
  href: string;
  button: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
      <Icon className="mx-auto size-8 text-violet-500" />
      <h2 className="mt-3 font-bold text-white">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{text}</p>
      <Link
        href={href}
        className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold text-black"
      >
        {button}
      </Link>
    </div>
  );
}
function ClapperboardIcon({ className }: { className?: string }) {
  return <Play className={className} />;
}
function cnTab(active: boolean) {
  return `flex shrink-0 items-center gap-1.5 rounded-t-xl px-4 py-3 text-xs font-bold transition ${active ? "border-b-2 border-violet-400 text-white" : "text-slate-500 hover:text-slate-200"}`;
}
