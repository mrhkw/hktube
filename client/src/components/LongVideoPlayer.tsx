import { useEffect, useRef, useState } from "react";
import { Bookmark, Check, Heart, MessageCircle, Share2, ThumbsDown, UserPlus } from "lucide-react";
import { Link } from "wouter";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { addVideoComment, getVideoEngagement, listVideoComments, recordVideoView, toggleChannelSubscription, toggleVideoLike, toggleVideoSave } from "@/lib/supabaseEngagement";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type CommentRow = { id: string; body: string; created_at: string; parent_id: string | null };
export type LongVideoPlayerProps = {
  videoId: string; videoUrl: string; poster?: string | null; title: string; description?: string | null;
  channelId?: string | null; channelName?: string | null; channelHandle?: string | null;
  views?: number; resumePosition?: number;
};

export default function LongVideoPlayer(props: LongVideoPlayerProps) {
  const { user } = useAuth();
  const [engagement, setEngagement] = useState({ liked: false, saved: false, subscribed: false, likeCount: 0, subscriberCount: 0 });
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [views, setViews] = useState(Number(props.views || 0));
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const viewed = useRef(false);

  useEffect(() => {
    setViews(Number(props.views || 0));
    void listVideoComments(props.videoId).then(rows => setComments(rows as CommentRow[])).catch(() => setComments([]));
    void getVideoEngagement(props.videoId, props.channelId).then(setEngagement).catch(() => undefined);
  }, [props.videoId, props.channelId, props.views]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.matches("input,textarea")) return;
      const video = playerRef.current;
      if (!video) return;
      if (event.key === " ") { event.preventDefault(); video.paused ? void video.play() : video.pause(); }
      if (event.key.toLowerCase() === "m") video.muted = !video.muted;
      if (event.key.toLowerCase() === "f") { event.preventDefault(); document.fullscreenElement ? void document.exitFullscreen() : void video.requestFullscreen?.(); }
      if (event.key === "ArrowLeft") video.currentTime = Math.max(0, video.currentTime - 5);
      if (event.key === "ArrowRight") video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 5);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function like() {
    if (!user) return startLogin();
    try { const result = await toggleVideoLike(props.videoId); setEngagement(s => ({ ...s, liked: result.liked, likeCount: Number(result.count) })); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update Like."); }
  }
  async function dislike() {
    if (!user) return startLogin();
    try {
      const result = await toggleVideoDislike(props.videoId);
      setEngagement((state) => ({
        ...state,
        disliked: result.disliked,
        liked: result.disliked ? false : state.liked,
        dislikeCount: result.count,
      }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update Dislike.",
      );
    }
  }

  async function save() {
    if (!user) return startLogin();
    try { const result = await toggleVideoSave(props.videoId); setEngagement(s => ({ ...s, saved: result })); toast.success(result ? "Saved to Library." : "Removed from Library."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update Save."); }
  }
  async function follow() {
    if (!user) return startLogin();
    if (!props.channelId) return;
    try { const result = await toggleChannelSubscription(props.channelId); setEngagement(s => ({ ...s, subscribed: result.subscribed, subscriberCount: Number(result.count) })); toast.success(result.subscribed ? "Following creator." : "Unfollowed creator."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update creator follow."); }
  }
  async function share() {
    const url = new URL(`/watch/${props.videoId}`, window.location.origin).toString();
    try { if (navigator.share) await navigator.share({ title: props.title, url }); else { await navigator.clipboard.writeText(url); toast.success("Video link copied."); } } catch {}
  }
  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;
    if (!user) return startLogin();
    setBusy(true);
    try { await addVideoComment(props.videoId, comment.trim()); setComment(""); setComments((await listVideoComments(props.videoId)) as CommentRow[]); toast.success("Comment published."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to post comment."); }
    finally { setBusy(false); }
  }

  return <section className="space-y-4">
    <div className="overflow-hidden rounded-2xl bg-black shadow-2xl">
      <video ref={playerRef} src={props.videoUrl} poster={props.poster || undefined} controls playsInline preload="metadata" className="aspect-video w-full object-contain"
        onLoadedMetadata={event => { const duration = event.currentTarget.duration; const resume = Number(props.resumePosition || 0); if (resume > 0 && resume < duration - 2) event.currentTarget.currentTime = resume; }}
        onPlay={() => { if (!viewed.current) { viewed.current = true; void recordVideoView(props.videoId).then(result => setViews(Number(result.views))).catch(() => undefined); } }}
      />
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => void like()} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-sm font-bold text-white"><Heart className={engagement.liked ? "size-4 fill-current text-rose-400" : "size-4"} />{engagement.likeCount.toLocaleString()}</button>
      <button onClick={() => void dislike()} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-sm font-bold text-white"><ThumbsDown className={engagement.disliked ? "size-4 fill-current" : "size-4"} />{engagement.dislikeCount.toLocaleString()}</button>
      <button onClick={() => void save()} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-sm font-bold text-white"><Bookmark className={engagement.saved ? "size-4 fill-current" : "size-4"} />{engagement.saved ? "Saved" : "Watch later"}</button>
      <button onClick={() => void share()} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-sm font-bold text-white"><Share2 className="size-4" />Share</button>
      {props.channelId && <button onClick={() => void follow()} className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-4 py-2 text-sm font-bold text-white">{engagement.subscribed ? <><Check className="size-4" />Following</> : <><UserPlus className="size-4" />Follow</>}</button>}
    </div>
    <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
      <div className="flex items-center gap-3"><div className="min-w-0 flex-1">{props.channelHandle ? <Link href={`/channel/${props.channelHandle}`} className="font-bold text-white">{props.channelName || "Creator"}</Link> : <p className="font-bold text-white">{props.channelName || "Creator"}</p>}<p className="mt-1 text-xs text-slate-500">{views.toLocaleString()} views</p></div></div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{props.description || "No description."}</p>
    </div>
    <section className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
      <div className="flex items-center gap-2 text-white"><MessageCircle className="size-5" /><h2 className="font-black">Comments</h2><span className="text-xs text-slate-500">{comments.length}</span></div>
      <form onSubmit={submitComment} className="mt-3 flex gap-2"><input value={comment} onChange={event => setComment(event.target.value.slice(0, 2000))} maxLength={2000} placeholder={user ? "Add a public comment…" : "Sign in to comment"} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none" /><button disabled={busy || !comment.trim()} className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Post</button></form>
      <div className="mt-4 space-y-2">{comments.map(row => <article key={row.id} className="rounded-xl border border-white/8 bg-black/15 p-3"><p className="text-sm text-slate-300">{row.body}</p><time className="mt-1 block text-[11px] text-slate-600">{new Date(row.created_at).toLocaleString()}</time></article>)}{!comments.length && <p className="py-6 text-center text-sm text-slate-500">No comments yet.</p>}</div>
    </section>
  </section>;
}
