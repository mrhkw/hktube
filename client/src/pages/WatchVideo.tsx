import { EmptyVideos, VideoCard } from "@/components/VideoCard";
import { HkTubeShell } from "@/components/HkTubeShell";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ChannelBadge } from "@/components/ChannelBadge";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { formatDate, formatViews, VideoRecord } from "@/lib/video";
import { trpc } from "@/lib/trpc";
import { Bookmark, Check, Eye, Heart, Loader2, MessageCircle, Share2, Sparkles, UserPlus } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";

function ActionCelebration({ type }: { type: "like" | "save" }) {
  return <span className="pointer-events-none absolute inset-0 grid place-items-center overflow-visible" aria-hidden="true">
    <span className={`absolute ${type === "like" ? "hktube-heart-burst" : "hktube-save-burst"}`}>
      {type === "like" ? <Heart className="size-9 fill-current text-rose-300 drop-shadow-[0_0_14px_rgba(251,113,133,.65)]" /> : <Sparkles className="size-9 text-cyan-200 drop-shadow-[0_0_14px_rgba(103,232,249,.65)]" />}
    </span>
    <span className="absolute flex gap-1.5">
      {Array.from({ length: 6 }).map((_, index) => <i key={index} className={`hktube-action-spark ${type === "like" ? "bg-rose-300" : "bg-cyan-200"}`} style={{ "--i": index } as React.CSSProperties} />)}
    </span>
  </span>;
}

export default function WatchVideo() {
  const [, params] = useRoute("/watch/:id");
  const id = Number(params?.id);
  const videoQuery = trpc.videos.byId.useQuery({ id }, { enabled: Number.isInteger(id) && id > 0 });
  const video = videoQuery.data as (VideoRecord & { channel?: { id: number; handle: string; displayName: string; avatarUrl: string | null; subscriberCount: number; verificationStatus: string } | null }) | undefined;
  const viewedVideoId = useRef<number | null>(null);
  const lastHistoryWrite = useRef(0);
  const recordView = trpc.videos.recordView.useMutation();
  const recordHistory = trpc.watch_history.record.useMutation();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const engagementQuery = trpc.videos.engagement.useQuery({ id }, { enabled: Boolean(video) });
  const likeMutation = trpc.videos.toggleLike.useMutation();
  const savedQuery = trpc.library.saved.useQuery(undefined, { enabled: Boolean(user) });
  const saveMutation = trpc.library.toggleSaved.useMutation({ onSuccess: () => void savedQuery.refetch() });
  const relatedQuery = trpc.videos.related.useQuery({ id: id || 1, category: video?.category || "regular" }, { enabled: Boolean(video) });
  const related = (relatedQuery.data ?? []) as VideoRecord[];
  const commentsQuery = trpc.comments.list.useQuery({ videoId: id }, { enabled: Boolean(video) });
  const channel = video?.channel;
  const channelQuery = trpc.channels.public.useQuery({ handle: channel?.handle || "___" }, { enabled: Boolean(channel?.handle) });
  const subscribeMutation = trpc.subscriptions.toggle.useMutation({ onSuccess: result => { void channelQuery.refetch(); toast.success(result.subscribed ? "You are now subscribed." : "Subscription removed."); }, onError: error => toast.error(error.message || "Unable to update subscription.") });
  const [commentBody, setCommentBody] = useState("");
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [likePulse, setLikePulse] = useState(false);
  const [savePulse, setSavePulse] = useState(false);
  const [shareLabel, setShareLabel] = useState("Share");
  const [commentSort, setCommentSort] = useState<"newest" | "oldest">("newest");
  const createComment = trpc.comments.create.useMutation({ onSuccess: () => { setCommentBody(""); void commentsQuery.refetch(); toast.success("Comment published."); }, onError: error => toast.error(error.message) });

  useEffect(() => {
    if (!video || viewedVideoId.current === video.id) return;
    viewedVideoId.current = video.id;
    recordView.mutate({ id: video.id }, { onSuccess: updatedVideo => { utils.videos.byId.setData({ id: video.id }, updatedVideo); } });
    if (user) recordHistory.mutate({ videoId: video.id });
  }, [video, recordHistory, recordView, user, utils]);

  if (videoQuery.isLoading) return <HkTubeShell><div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-7 animate-spin text-fuchsia-300" /></div></HkTubeShell>;
  if (!video) return <HkTubeShell title="Video unavailable"><EmptyVideos title="This video is not available" copy="It may have been removed from the HKTUBE catalog or the link is incorrect." /></HkTubeShell>;
  const activeVideo = video;

  async function shareVideo() {
    const url = new URL(`/watch/${activeVideo.id}`, window.location.origin).toString();
    try {
      if (navigator.share) await navigator.share({ title: activeVideo.title, text: activeVideo.description || undefined, url });
      else { await navigator.clipboard.writeText(url); toast.success("Video link copied."); }
      setShareLabel("Copied");
      window.setTimeout(() => setShareLabel("Share"), 1800);
    } catch (error) { if ((error as DOMException | undefined)?.name !== "AbortError") toast.error("Unable to share this video from this browser."); }
  }

  function toggleLike() {
    if (!user) return startLogin();
    likeMutation.mutate({ id: activeVideo.id }, { onSuccess: engagement => { utils.videos.engagement.setData({ id: activeVideo.id }, engagement); if (engagement.likedByViewer) { setLikePulse(true); window.setTimeout(() => setLikePulse(false), 620); } }, onError: error => toast.error(error.message || "Unable to update like.") });
  }

  const isSaved = Boolean(savedQuery.data?.some(item => item.video.id === activeVideo.id));
  const comments = [...(commentsQuery.data ?? [])].sort((a, b) => commentSort === "newest" ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  function saveWatchProgress(seconds: number) {
    if (!user || !Number.isFinite(seconds) || seconds < 1) return;
    const now = Date.now();
    if (now - lastHistoryWrite.current < 15000) return;
    lastHistoryWrite.current = now;
    recordHistory.mutate({ videoId: activeVideo.id, watchedSeconds: Math.floor(seconds) });
  }

  function toggleSaved() {
    if (!user) return startLogin();
    saveMutation.mutate({ videoId: activeVideo.id }, { onSuccess: result => { if (result?.saved) { setSavePulse(true); window.setTimeout(() => setSavePulse(false), 620); } toast.success(result?.saved ? "Added to Watch Later." : "Removed from Watch Later."); }, onError: error => toast.error(error.message || "Unable to update Watch Later.") });
  }

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentBody.trim()) return;
    if (!user) return startLogin();
    createComment.mutate({ videoId: activeVideo.id, body: commentBody.trim() });
  }

  return <HkTubeShell immersive={video.category === "shorts"}>
    <div className="mx-auto grid w-full max-w-[1560px] gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0">
        <VideoPlayer video={video} onProgress={saveWatchProgress} />
        <div className="border-b border-white/8 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-xs font-semibold uppercase tracking-[.17em] text-cyan-300">{video.category === "shorts" ? "HKTUBE Short" : "HKTUBE Video"}</span><h1 className="mt-1.5 text-xl font-bold tracking-tight text-white sm:text-2xl">{video.title}</h1></div><span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/20 bg-violet-400/8 px-3 py-1.5 text-xs font-medium text-violet-100"><Eye className="size-3.5" />{formatViews(video.viewCount)}</span></div>
          {channel && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-white/[.025] p-3"><Link href={`/channel/${channel.handle}`} className="flex min-w-0 items-center gap-3 rounded-xl pr-2 transition hover:opacity-90"><span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-violet-500/25 text-sm font-black text-white">{channel.avatarUrl ? <img src={channel.avatarUrl} alt="" className="size-full object-cover" /> : channel.displayName.slice(0, 1).toUpperCase()}</span><span className="min-w-0"><span className="flex items-center gap-1.5 truncate text-sm font-bold text-white">{channel.displayName}<ChannelBadge subscriberCount={channel.subscriberCount} verified={channel.verificationStatus === "verified"} /></span><span className="block text-xs text-slate-500">@{channel.handle} · {channel.subscriberCount.toLocaleString()} subscribers</span></span></Link><Button type="button" size="sm" onClick={() => user ? subscribeMutation.mutate({ channelId: channel.id }) : startLogin()} disabled={subscribeMutation.isPending} className="ml-auto shrink-0 rounded-full bg-violet-500 px-4 text-white hover:bg-violet-400">{channelQuery.data?.subscribed ? <><Check className="mr-1.5 size-4" />Subscribed</> : <><UserPlus className="mr-1.5 size-4" />Subscribe</>}</Button></div>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative"><Button variant="outline" size="sm" onClick={toggleLike} disabled={likeMutation.isPending} className={engagementQuery.data?.likedByViewer ? "border-red-300/35 bg-red-500/15 text-red-100 hover:bg-red-500/25" : "border-white/10 text-slate-200 hover:bg-white/8"}><Heart className={`mr-1.5 size-4 ${engagementQuery.data?.likedByViewer ? "fill-current" : ""} ${likePulse ? "hktube-like-pop" : ""}`} />{engagementQuery.data?.likeCount ?? 0}</Button>{likePulse && <ActionCelebration type="like" />}</div>
            <Button variant="outline" size="sm" onClick={() => void shareVideo()} className="border-white/10 text-slate-200 hover:bg-white/8"><Share2 className="mr-1.5 size-4" />{shareLabel}</Button>
            <div className="relative"><Button variant="outline" size="sm" onClick={toggleSaved} disabled={saveMutation.isPending} className={isSaved ? "border-cyan-300/35 bg-cyan-400/10 text-cyan-100" : "border-white/10 text-slate-200 hover:bg-white/8"}><Bookmark className={`mr-1.5 size-4 ${isSaved ? "fill-current" : ""}`} />{isSaved ? "Saved" : "Watch later"}</Button>{savePulse && <ActionCelebration type="save" />}</div>
          </div>
          <div className="mt-4 max-w-3xl"><p className={`whitespace-pre-wrap text-sm leading-6 text-slate-400 ${descriptionExpanded ? "max-h-72 overflow-y-auto" : "line-clamp-3"}`}>{video.description || "No description was provided for this video."}</p>{(video.description?.length ?? 0) > 260 && <button type="button" onClick={() => setDescriptionExpanded(value => !value)} className="mt-2 text-xs font-bold text-cyan-300 hover:text-cyan-200">{descriptionExpanded ? "Show less" : "Show more"}</button>}</div>
          <p className="mt-3 text-xs text-slate-600">Published {formatDate(video.uploadedAt)}</p>
        </div>
        <section className="border-b border-white/8 py-6">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><MessageCircle className="size-4 text-fuchsia-300" /><h2 className="text-sm font-bold uppercase tracking-[.16em] text-slate-300">Comments</h2><span className="text-xs text-slate-500">{comments.length}</span></div><select value={commentSort} onChange={event => setCommentSort(event.target.value as "newest" | "oldest")} aria-label="Sort comments" className="rounded-lg border border-white/10 bg-white/[.04] px-2 py-1 text-xs text-slate-300"><option value="newest">Newest</option><option value="oldest">Oldest</option></select></div>
          <form onSubmit={submitComment} className="mt-4 flex gap-2"><input value={commentBody} onChange={event => setCommentBody(event.target.value)} placeholder={user ? "Share your thoughts" : "Sign in to comment"} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[.045] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-fuchsia-400/60" /><Button type="submit" disabled={createComment.isPending || !commentBody.trim()} size="sm">Post</Button></form>
          <div className="mt-5 space-y-4">{comments.length ? comments.map(comment => <article key={comment.id} className="rounded-xl border border-white/7 bg-white/[.025] p-4"><p className="text-sm leading-6 text-slate-300">{comment.body}</p><p className="mt-2 text-xs text-slate-600">{formatDate(comment.createdAt)}</p></article>) : <p className="py-6 text-sm text-slate-500">No comments yet. Be the first to contribute a real comment.</p>}</div>
        </section>
      </section>
      <aside className="border-t border-white/8 pt-7 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"><h2 className="mb-4 text-sm font-bold uppercase tracking-[.16em] text-slate-300">Related videos</h2>{relatedQuery.isLoading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-white/5" />)}</div> : related.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">{related.map(item => <VideoCard key={item.id} video={item} compact />)}</div> : <EmptyVideos title="No related videos" copy="Related videos will appear as authentic content is published." />}</aside>
    </div>
  </HkTubeShell>;
}
