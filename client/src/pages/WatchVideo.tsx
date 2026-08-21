import { EmptyVideos, VideoCard } from "@/components/VideoCard";
import { HkTubeShell } from "@/components/HkTubeShell";
import { VideoPlayer } from "@/components/VideoPlayer";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { formatDate, formatViews, VideoRecord } from "@/lib/video";
import { trpc } from "@/lib/trpc";
import { Eye, Heart, Loader2, MessageCircle, Share2 } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { toast } from "sonner";

export default function WatchVideo() {
  const [, params] = useRoute("/watch/:id");
  const id = Number(params?.id);
  const videoQuery = trpc.videos.byId.useQuery({ id }, { enabled: Number.isInteger(id) && id > 0 });
  const video = videoQuery.data as VideoRecord | undefined;
  const viewedVideoId = useRef<number | null>(null);
  const recordView = trpc.videos.recordView.useMutation();
  const recordHistory = trpc.watch_history.record.useMutation();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const engagementQuery = trpc.videos.engagement.useQuery({ id }, { enabled: Boolean(video) });
  const likeMutation = trpc.videos.toggleLike.useMutation();
  const relatedQuery = trpc.videos.related.useQuery({ id: id || 1, category: video?.category || "regular" }, { enabled: Boolean(video) });
  const related = (relatedQuery.data ?? []) as VideoRecord[];
  const commentsQuery = trpc.comments.list.useQuery({ videoId: id }, { enabled: Boolean(video) });
  const [commentBody, setCommentBody] = useState("");
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
    } catch (error) { if ((error as DOMException | undefined)?.name !== "AbortError") toast.error("Unable to share this video from this browser."); }
  }

  function toggleLike() {
    if (!user) return startLogin();
    likeMutation.mutate({ id: activeVideo.id }, { onSuccess: engagement => { utils.videos.engagement.setData({ id: activeVideo.id }, engagement); }, onError: error => toast.error(error.message || "Unable to update like.") });
  }

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentBody.trim()) return;
    if (!user) return startLogin();
    createComment.mutate({ videoId: activeVideo.id, body: commentBody.trim() });
  }

  return <HkTubeShell>
    <div className="mx-auto max-w-[1560px] xl:grid xl:grid-cols-[minmax(0,1fr)_330px] xl:gap-7">
      <section className="min-w-0">
        <VideoPlayer video={video} />
        <div className="border-b border-white/8 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-xs font-semibold uppercase tracking-[.17em] text-cyan-300">{video.category === "shorts" ? "HKTUBE Short" : "HKTUBE Video"}</span><h1 className="mt-1.5 text-xl font-bold tracking-tight text-white sm:text-2xl">{video.title}</h1></div><span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/20 bg-violet-400/8 px-3 py-1.5 text-xs font-medium text-violet-100"><Eye className="size-3.5" />{formatViews(video.viewCount)}</span></div>
          <div className="mt-4 flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={toggleLike} disabled={likeMutation.isPending} className={engagementQuery.data?.likedByViewer ? "border-fuchsia-300/35 bg-fuchsia-500/15 text-fuchsia-100 hover:bg-fuchsia-500/25" : "border-white/10 text-slate-200 hover:bg-white/8"}><Heart className={`mr-1.5 size-4 ${engagementQuery.data?.likedByViewer ? "fill-current" : ""}`} />{engagementQuery.data?.likeCount ?? 0}</Button><Button variant="outline" size="sm" onClick={() => void shareVideo()} className="border-white/10 text-slate-200 hover:bg-white/8"><Share2 className="mr-1.5 size-4" />Share</Button></div>
          <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-400">{video.description || "No description was provided for this video."}</p>
          <p className="mt-3 text-xs text-slate-600">Published {formatDate(video.uploadedAt)}</p>
        </div>
        <section className="border-b border-white/8 py-6">
          <div className="flex items-center gap-2"><MessageCircle className="size-4 text-fuchsia-300" /><h2 className="text-sm font-bold uppercase tracking-[.16em] text-slate-300">Comments</h2><span className="text-xs text-slate-500">{commentsQuery.data?.length ?? 0}</span></div>
          <form onSubmit={submitComment} className="mt-4 flex gap-2"><input value={commentBody} onChange={event => setCommentBody(event.target.value)} placeholder={user ? "Share your thoughts" : "Sign in to comment"} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[.045] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-fuchsia-400/60" /><Button type="submit" disabled={createComment.isPending || !commentBody.trim()} size="sm">Post</Button></form>
          <div className="mt-5 space-y-4">{commentsQuery.data?.length ? commentsQuery.data.map(comment => <article key={comment.id} className="rounded-xl border border-white/7 bg-white/[.025] p-4"><p className="text-sm leading-6 text-slate-300">{comment.body}</p><p className="mt-2 text-xs text-slate-600">{formatDate(comment.createdAt)}</p></article>) : <p className="py-6 text-sm text-slate-500">No comments yet. Be the first to contribute a real comment.</p>}</div>
        </section>
      </section>
      <aside className="mt-7 xl:mt-0"><h2 className="mb-4 text-sm font-bold uppercase tracking-[.16em] text-slate-300">Related videos</h2>{relatedQuery.isLoading ? <div className="space-y-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-white/5" />)}</div> : related.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">{related.map(item => <VideoCard key={item.id} video={item} compact />)}</div> : <EmptyVideos title="No related videos" copy="Related videos will appear as authentic content is published." />}</aside>
    </div>
  </HkTubeShell>;
}
