import { HkTubeShell } from "@/components/HkTubeShell";
import { EmptyVideos, VideoCard } from "@/components/VideoCard";
import { LiveRoom } from "@/components/LiveRoom";
import { LibraryHub } from "@/components/LibraryHub";
import { CreatorStudioHub } from "@/components/CreatorStudioHub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { formatDate, VideoRecord } from "@/lib/video";
import {
  Bell,
  Clock3,
  FolderHeart,
  Inbox,
  Library,
  ListVideo,
  Loader2,
  Radio,
  Sparkles,
  UsersRound,
  Upload,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { FormEvent, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export type PlatformSectionKind =
  | "posts"
  | "subscriptions"
  | "live"
  | "notifications"
  | "playlists"
  | "history"
  | "library"
  | "studio"
  | "profile";

type SectionCopy = { title: string; subtitle: string; icon: LucideIcon };

const copy: Record<PlatformSectionKind, SectionCopy> = {
  subscriptions: { title: "Following", subtitle: "Channels you follow on HkTube.", icon: UsersRound },
  posts: { title: "Posts", subtitle: "Updates and conversations published by real HkTube creators.", icon: Sparkles },
  live: { title: "Live", subtitle: "Discover live streams currently available in HkTube.", icon: Radio },
  notifications: { title: "Notifications", subtitle: "Stay up to date with activity connected to your account.", icon: Bell },
  playlists: { title: "Playlists", subtitle: "Organize videos you have saved into personal collections.", icon: ListVideo },
  history: { title: "Watch history", subtitle: "Your recent viewing activity, when recorded while signed in.", icon: Clock3 },
  library: { title: "Library", subtitle: "Saved videos and your personal HkTube collections.", icon: FolderHeart },
  studio: { title: "Creator Studio", subtitle: "Manage your content and review real catalog activity.", icon: Upload },
  profile: { title: "Profile", subtitle: "Your public HkTube identity and channel activity.", icon: UserRound },
};

function SignInState() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.035] p-8 text-center">
      <UserRound className="mx-auto size-8 text-fuchsia-300" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-bold text-white">Sign in to continue</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">This section shows only records returned for your HkTube account.</p>
      <Button onClick={startLogin} className="mt-5 bg-gradient-to-r from-violet-500 to-fuchsia-500">Sign in</Button>
    </div>
  );
}

function LoadingState() {
  return <div className="grid min-h-[28vh] place-items-center"><Loader2 className="size-7 animate-spin text-fuchsia-300" aria-label="Loading" /></div>;
}

export function PlatformSection({ kind }: { kind: PlatformSectionKind }) {
  const meta = copy[kind];
  const Icon = meta.icon;
  const auth = trpc.auth.me.useQuery();
  const isAuthed = Boolean(auth.data);
  const posts = trpc.posts.latest.useQuery({ limit: 50 }, { enabled: kind === "posts" });
  const notifications = trpc.notifications.mine.useQuery(undefined, { enabled: isAuthed && kind === "notifications" });
  const playlists = trpc.playlists.mine.useQuery(undefined, { enabled: isAuthed && (kind === "playlists" || kind === "library") });
  const history = trpc.watch_history.mine.useQuery(undefined, { enabled: isAuthed && (kind === "history" || kind === "library") });
  const library = trpc.library.saved.useQuery(undefined, { enabled: isAuthed && kind === "library" });
  const studio = trpc.creator_studio.dashboard.useQuery(undefined, { enabled: isAuthed && kind === "studio" });
  const following = trpc.subscriptions.mine.useQuery(undefined, { enabled: isAuthed && (kind === "subscriptions" || kind === "library") });
  const live = trpc.live.latest.useQuery({ limit: 36 }, { enabled: kind === "live" });
  const [title, setTitle] = useState("");
  const createPlaylist = trpc.playlists.create.useMutation({
    onSuccess: () => { setTitle(""); void playlists.refetch(); toast.success("Playlist created."); },
    onError: error => toast.error(error.message),
  });

  function submitPlaylist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim()) createPlaylist.mutate({ title: title.trim(), visibility: "private" });
  }

  const videoItems: VideoRecord[] = kind === "history"
    ? (history.data ?? []).map(item => item.video as VideoRecord)
    : kind === "library"
      ? (library.data ?? []).map(item => item.video as VideoRecord)
      : kind === "studio"
        ? (studio.data?.videos ?? []) as VideoRecord[]
        : [];

  const privateQuery = kind === "notifications" ? notifications : kind === "playlists" ? playlists : kind === "history" ? history : kind === "library" ? library : kind === "studio" ? studio : kind === "subscriptions" ? following : null;
  const queryLoading = kind === "posts" ? posts.isLoading : kind === "live" ? live.isLoading : Boolean(privateQuery?.isLoading);
  const queryError = kind === "posts" ? posts.isError : kind === "live" ? live.isError : Boolean(privateQuery?.isError);

  if (kind === "live") {
    return <HkTubeShell><LiveRoom items={live.data ?? []} loading={live.isLoading} error={live.isError} /></HkTubeShell>;
  }
  if (kind === "library") {
    if (!isAuthed) return <HkTubeShell title="Library" subtitle="Your saved videos, history, and collections."><SignInState /></HkTubeShell>;
    if (library.isLoading || history.isLoading || playlists.isLoading || following.isLoading) return <HkTubeShell title="Library"><LoadingState /></HkTubeShell>;
    if (library.isError || history.isError || playlists.isError || following.isError) return <HkTubeShell title="Library"><EmptyVideos title="Library could not load" copy="Please refresh and try again. HkTube only shows records belonging to your account." icon={Inbox} /></HkTubeShell>;
    return <HkTubeShell><LibraryHub saved={library.data ?? []} history={history.data ?? []} playlists={playlists.data ?? []} following={following.data ?? []} /></HkTubeShell>;
  }
  if (kind === "studio") {
    if (!isAuthed) return <HkTubeShell title="Creator Studio" subtitle="Manage creator-owned HkTube content."><SignInState /></HkTubeShell>;
    if (studio.isLoading) return <HkTubeShell title="Creator Studio"><LoadingState /></HkTubeShell>;
    if (studio.isError) return <HkTubeShell title="Creator Studio"><EmptyVideos title="Creator Studio could not load" copy="Please refresh and try again. This workspace only reads content belonging to your account." icon={Inbox} /></HkTubeShell>;
    return <HkTubeShell><CreatorStudioHub videos={studio.data?.videos ?? []} analytics={studio.data?.analytics ?? { totalViews: 0, contentCount: 0, regularCount: 0, shortsCount: 0 }} /></HkTubeShell>;
  }

  let content: ReactNode;
  if (!isAuthed && ["subscriptions", "notifications", "playlists", "history", "library", "studio", "profile"].includes(kind)) {
    content = <SignInState />;
  } else if (queryLoading) {
    content = <LoadingState />;
  } else if (queryError) {
    content = <EmptyVideos title={`${meta.title} could not load`} copy="Please refresh and try again. This section reads only from HkTube's live database." icon={Inbox} />;
  } else if (kind === "posts") {
    content = <PostsFeed posts={posts.data ?? []} />;
  } else if (kind === "subscriptions") {
    content = following.data?.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{following.data.map(item => <article key={item.subscription.id} className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><div className="flex items-center gap-3">{item.channel.avatarUrl ? <img src={item.channel.avatarUrl} alt="" className="size-11 rounded-full object-cover" /> : <span className="grid size-11 place-items-center rounded-full bg-fuchsia-500/15 text-fuchsia-200"><UsersRound className="size-5" aria-hidden="true" /></span>}<div className="min-w-0"><h2 className="truncate font-semibold text-white">{item.channel.displayName}</h2><p className="truncate text-xs text-slate-500">@{item.channel.handle}</p></div></div><p className="mt-4 text-sm text-slate-400">{item.channel.subscriberCount} followers</p></article>)}</div> : <EmptyVideos title="No channels followed yet" copy="Follow channels to keep their latest activity close at hand." icon={UsersRound} />;
  } else if (kind === "notifications") {
    content = <Notifications items={notifications.data ?? []} onRead={() => void notifications.refetch()} />;
  } else if (kind === "playlists") {
    content = <div className="space-y-5"><form onSubmit={submitPlaylist} className="flex gap-2"><Input value={title} onChange={event => setTitle(event.target.value)} placeholder="Create a private playlist" className="max-w-md border-white/10 bg-white/[.045] text-white" /><Button type="submit" disabled={createPlaylist.isPending}>Create</Button></form>{playlists.data?.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{playlists.data.map(playlist => <div key={playlist.id} className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><h2 className="font-semibold text-white">{playlist.title}</h2><p className="mt-2 text-xs text-slate-400">{playlist.visibility} playlist</p></div>)}</div> : <EmptyVideos title="No playlists yet" copy="Create a playlist to organize videos you have chosen to keep." icon={ListVideo} />}</div>;
  } else {
    content = videoItems.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{videoItems.map(video => <VideoCard key={video.id} video={video} />)}</div> : <EmptyVideos title={`No ${meta.title.toLowerCase()} records yet`} copy="This view is connected to the live database and will populate when the feature is used." icon={meta.icon} />;
  }

  return <HkTubeShell title={meta.title} subtitle={meta.subtitle}><div className="mx-auto max-w-6xl"><div className="mb-6 flex items-center gap-3 rounded-2xl border border-fuchsia-400/15 bg-gradient-to-r from-violet-500/10 to-cyan-400/5 p-5"><Icon className="size-6 text-fuchsia-300" aria-hidden="true" /><div><p className="text-sm font-semibold text-white">Authentic HkTube records</p><p className="mt-1 text-xs text-slate-400">No demo content is inserted when the database or provider is unavailable.</p></div></div>{content}</div></HkTubeShell>;
}

function PostsFeed({ posts }: { posts: Array<{ id: number; body: string; createdAt: Date }> }) {
  if (!posts.length) return <EmptyVideos title="No posts yet" copy="Creator posts appear here after they are published to HkTube." icon={Sparkles} />;
  return <div className="mx-auto max-w-2xl space-y-4">{posts.map(post => <article key={post.id} className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{post.body}</p><p className="mt-4 text-xs text-slate-500">Published {formatDate(post.createdAt)}</p></article>)}</div>;
}

function Notifications({ items, onRead }: { items: Array<{ id: number; title: string; body: string | null; href: string | null; readAt: Date | null; createdAt: Date }>; onRead: () => void }) {
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: onRead });
  if (!items.length) return <EmptyVideos title="No notifications" copy="New account activity will be shown here when HkTube records it." icon={Bell} />;
  return <div className="mx-auto max-w-2xl space-y-3">{items.map(item => <div key={item.id} className={`flex items-start justify-between gap-4 rounded-2xl border p-4 ${item.readAt ? "border-white/8 bg-white/[.02]" : "border-fuchsia-400/20 bg-fuchsia-400/[.06]"}`}><div><p className="font-semibold text-white">{item.href ? <Link href={item.href} className="hover:text-fuchsia-200">{item.title}</Link> : item.title}</p>{item.body && <p className="mt-1 text-sm text-slate-400">{item.body}</p>}<p className="mt-2 text-xs text-slate-600">{formatDate(item.createdAt)}</p></div>{!item.readAt && <Button variant="outline" size="sm" onClick={() => markRead.mutate({ id: item.id })}>Mark read</Button>}</div>)}</div>;
}
