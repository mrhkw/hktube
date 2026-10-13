import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { HkTubeShell } from "@/components/HkTubeShell";
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
import { uploadProfileImage } from "@/lib/profileMedia";
import { Link, useLocation } from "wouter";
import {
  Bookmark,
  CircleUserRound,
  Edit3,
  FileText,
  ImageOff,
  Loader2,
  Play,
  Share2,
  X,
  ListVideo,
  ImagePlus,
  Users,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

type ProfileTab = "videos" | "clips" | "posts" | "favorites";

export default function Profile() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [channel, setChannel] = useState<SupabaseChannel | null>(null);
  const [videos, setVideos] = useState<SupabaseVideo[]>([]);
  const [favorites, setFavorites] = useState<SupabaseVideo[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [posts, setPosts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<ProfileTab>("videos");

  async function loadProfile() {
    if (!user) return;
    setDataLoading(true);
    try {
      const [channels, ownVideos, ownPosts] = await Promise.all([
        listMySupabaseChannels(),
        listMySupabaseVideos(String(user.id)),
        supabase
          .from("posts")
          .select("id,content,media_paths,media_path,created_at,likes_count")
          .eq("creator_id", user.id)
          .eq("visibility", "public")
          .eq("status", "published")
          .eq("moderation_status", "approved")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      setChannel(channels[0] ?? null);
      setVideos(ownVideos);
      setPosts(ownPosts.data ?? []);
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
  useEffect(() => {
    if (channel) {
      setDisplayName(channel.displayName);
      setDescription(channel.description || "");
      setAvatarFile(null);
      setAvatarPreview("");
    }
  }, [channel?.id, channel?.displayName, channel?.description]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!channel) return;
    try {
      setSaving(true);
      const avatar = avatarFile ? await uploadProfileImage(avatarFile) : null;
      setChannel(
        await updateSupabaseChannel(channel.id, {
          displayName: displayName.trim(),
          description: description.trim(),
          avatarUrl: avatar?.url ?? channel.avatarUrl,
        })
      );
      setEditOpen(false);
      toast.success("Profile updated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update profile."
      );
    } finally {
      setSaving(false);
    }
  }
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
      <HkTubeShell title="Profile" headerAvatarUrl={channel?.avatarUrl}>
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
      <div className="mx-auto w-full max-w-6xl px-3 py-3 pb-4 sm:px-6 sm:py-7">
        <section className="rounded-[28px] border border-white/10 bg-[#111522] p-5 shadow-xl shadow-black/10 sm:p-8">
          <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 sm:flex sm:items-center sm:gap-5">
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/10 bg-violet-600 text-2xl font-black text-white sm:size-28 sm:text-3xl">
              {channel?.avatarUrl || user?.avatarUrl ? (
                <img
                  src={channel?.avatarUrl || user?.avatarUrl || ""}
                  alt="Channel logo"
                  className="size-full object-cover"
                />
              ) : (
                (channel?.displayName || user.name || "H")
                  .slice(0, 1)
                  .toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-violet-300">
                Your channel
              </p>
              <h1 className="mt-1 truncate text-2xl font-black text-white sm:text-3xl">
                {channel?.displayName || user.name || "HkTube Creator"}
              </h1>
              <p className="mt-0.5 text-sm text-slate-400">
                @{channel?.handle || "creator"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" />
                  {(channel?.subscriberCount ?? 0).toLocaleString()} subscribers
                </span>
                <span>
                  {
                    videos.filter(v => !v.isShort && !v.tags.includes("shorts"))
                      .length
                  }{" "}
                  long videos
                </span>
                <span>
                  {
                    videos.filter(v => v.isShort || v.tags.includes("shorts"))
                      .length
                  }{" "}
                  clips
                </span>
                <span>{posts.length} posts</span>
              </div>
              <p className="mt-2 line-clamp-2 max-w-3xl text-xs leading-5 text-slate-400 sm:mt-3 sm:text-sm sm:leading-6">
                {channel?.description ||
                  "Add a channel description to tell viewers what you create."}
              </p>
            </div>
            <div className="col-span-full flex flex-wrap gap-2 sm:ml-auto sm:justify-end">
              <Button
                type="button"
                onClick={() => setEditOpen(true)}
                disabled={!channel}
                className="rounded-full bg-white px-4 font-bold text-black"
              >
                <Edit3 className="mr-1.5 size-4" />
                Edit channel
              </Button>
              {channel && (
                <Link
                  href={`/channel/${channel.handle}`}
                  className="inline-flex h-10 items-center rounded-full border border-white/10 bg-white/[.04] px-4 text-sm font-bold text-white"
                >
                  <ExternalLink className="mr-1.5 size-4" />
                  View channel
                </Link>
              )}
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
              posts.length ? (
                <div className="mx-auto max-w-2xl space-y-4">
                  {posts.map(post => {
                    const media = Array.isArray(post.media_paths)
                      ? post.media_paths
                      : post.media_path
                        ? [post.media_path]
                        : [];
                    return (
                      <article
                        key={post.id}
                        className="rounded-2xl border border-white/10 bg-white/[.03] p-4 sm:p-5"
                      >
                        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">
                          {post.content}
                        </p>
                        {media.length > 0 && (
                          <div
                            className={`mt-4 grid gap-2 ${media.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
                          >
                            {media
                              .slice(0, 4)
                              .map((path: string, index: number) => (
                                <img
                                  key={`${path}-${index}`}
                                  src={
                                    path.startsWith("http")
                                      ? path
                                      : supabase.storage
                                          .from("thumbnails")
                                          .getPublicUrl(path).data.publicUrl
                                  }
                                  alt="Post attachment"
                                  className="max-h-96 w-full rounded-xl object-cover"
                                  loading="lazy"
                                />
                              ))}
                          </div>
                        )}
                        <p className="mt-3 text-xs text-slate-500">
                          {Number(post.likes_count || 0).toLocaleString()} likes
                          · {new Date(post.created_at).toLocaleDateString()}
                        </p>
                      </article>
                    );
                  })}
                  <Link
                    href="/upload/post"
                    className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold text-black"
                  >
                    Write a post
                  </Link>
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No public posts yet"
                  text="Create a post to share updates with your audience."
                  href="/upload/post"
                  button="Create a post"
                />
              )
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

      {editOpen && (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={saveProfile}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111522] p-5 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">Edit channel</h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="grid size-9 place-items-center rounded-full bg-white/[.06] text-slate-300"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.03] p-4">
                <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-violet-500/20 text-xl font-black">
                  {avatarPreview || channel?.avatarUrl ? (
                    <img
                      src={avatarPreview || channel?.avatarUrl || ""}
                      alt="Channel logo preview"
                      className="size-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="size-6" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold">Channel logo</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Square image · JPG, PNG, WebP, AVIF or GIF · max 12 MB
                  </p>
                  <label className="mt-2 inline-flex cursor-pointer rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black">
                    {avatarFile ? "Change logo" : "Upload logo"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 12 * 1024 * 1024)
                          return void toast.error(
                            "Image must be 12 MB or smaller."
                          );
                        setAvatarFile(file);
                        setAvatarPreview(URL.createObjectURL(file));
                      }}
                    />
                  </label>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300">
                  Channel name
                </label>
                <Input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  maxLength={255}
                  className="mt-1 border-white/10 bg-black/20 text-white"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300">
                  Description
                </label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  maxLength={5000}
                  rows={4}
                  className="mt-1 border-white/10 bg-black/20 text-white"
                  placeholder="Tell viewers about your channel"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                className="border-white/10 text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-violet-600 text-white"
              >
                {saving ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Save changes
              </Button>
            </div>
          </form>
        </div>
      )}
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
