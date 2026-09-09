import { EmptyVideos, VideoCard } from "@/components/VideoCard";
import { HkTubeShell } from "@/components/HkTubeShell";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatDate, formatViews, VideoRecord } from "@/lib/video";
import { trpc } from "@/lib/trpc";
import { Bookmark, EyeOff, Heart, MessageCircle, MoreVertical, Play, Radio, Send, Settings2, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export function VideoCollection({ kind }: { kind: "shorts" | "trending" }) {
  if (kind === "shorts") return <ShortsFeed />;
  const query = trpc.videos.trending.useQuery({ limit: 36 });
  const videos = (query.data ?? []) as VideoRecord[];
  return <HkTubeShell title="Trending" subtitle="Videos ordered by authentic engagement and recency.">{query.isLoading ? <VideoGridSkeleton /> : query.isError ? <EmptyVideos title="Videos could not be loaded" copy="Please refresh the page. The catalog is read directly from the live HKTUBE database." /> : videos.length ? <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2 xl:grid-cols-4">{videos.map(video => <VideoCard key={video.id} video={video} />)}</div> : <EmptyVideos title="No videos published" copy="Trending will appear as viewers watch published HKTUBE videos." />}</HkTubeShell>;
}

function ShortsFeed() {
  const [familyMode, setFamilyMode] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [dataSaver, setDataSaver] = useState(false);
  useEffect(() => { setFamilyMode(localStorage.getItem("hktube-family-mode") === "enabled"); setAutoplay(localStorage.getItem("hktube-autoplay") !== "disabled"); setDataSaver(localStorage.getItem("hktube-data-saver") === "enabled"); }, []);
  const query = trpc.videos.shorts.useQuery({ limit: 36 }, { enabled: !familyMode });
  const videos = (query.data ?? []) as VideoRecord[];
  return <HkTubeShell immersive><div className="bg-black max-lg:h-[100dvh] max-lg:w-screen max-lg:overflow-y-auto max-lg:snap-y max-lg:snap-mandatory max-lg:overscroll-y-contain">{familyMode ? <div className="grid min-h-[100dvh] place-items-center bg-[#090c14] p-5"><EmptyVideos title="Shorts are hidden" copy="Family Mode is enabled in Settings for this browser." /></div> : query.isLoading ? <div className="grid min-h-[100dvh] place-items-center bg-[#090c14]"><Radio className="size-8 animate-pulse text-fuchsia-300" /></div> : query.isError ? <div className="grid min-h-[100dvh] place-items-center bg-[#090c14] p-5"><EmptyVideos title="Shorts could not load" copy="Refresh and try again. HKTUBE does not substitute demo content." /></div> : videos.length ? <div className="max-lg:space-y-0 lg:mx-auto lg:max-w-md lg:space-y-6">{videos.map(video => <ShortCard key={video.id} video={video} autoplay={autoplay} dataSaver={dataSaver} />)}</div> : <div className="grid min-h-[100dvh] place-items-center bg-[#090c14] p-5"><EmptyVideos title="No Shorts published" copy="Real vertical videos will appear here when creators publish them." /></div>}</div></HkTubeShell>;
}

function ShortCard({ video, autoplay, dataSaver }: { video: VideoRecord; autoplay: boolean; dataSaver: boolean }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const engagement = trpc.videos.engagement.useQuery({ id: video.id });
  const comments = trpc.comments.list.useQuery({ videoId: video.id });
  const like = trpc.videos.toggleLike.useMutation({ onSuccess: data => utils.videos.engagement.setData({ id: video.id }, data), onError: error => toast.error(error.message) });
  const save = trpc.library.toggleSaved.useMutation({ onSuccess: result => toast.success(result?.saved ? "Saved to Watch Later." : "Removed from Watch Later."), onError: error => toast.error(error.message) });
  const report = trpc.reports.create.useMutation({ onSuccess: () => toast.success("Report submitted."), onError: error => toast.error(error.message) });
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(!autoplay);
  const [progress, setProgress] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [clearScreen, setClearScreen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const cardRef = useRef<HTMLElement>(null);
  const mediaRef = useRef<HTMLVideoElement>(null);
  const lastTap = useRef(0);
  const holdTimer = useRef<number | null>(null);

  const requireLogin = () => { if (!user) { startLogin(); return false; } return true; };
  useEffect(() => { const card = cardRef.current; const media = mediaRef.current; if (!card || !media) return; const observer = new IntersectionObserver(entries => { const entry = entries[0]; if (entry?.isIntersecting && autoplay) void media.play().catch(() => undefined); else media.pause(); }, { threshold: 0.7 }); observer.observe(card); return () => observer.disconnect(); }, [autoplay]);
  useEffect(() => () => { if (holdTimer.current) window.clearTimeout(holdTimer.current); }, []);

  const togglePlayback = () => { const element = mediaRef.current; if (!element) return; if (element.paused) void element.play(); else element.pause(); };
  const handleTap = () => { const now = Date.now(); if (now - lastTap.current < 280) { if (requireLogin() && !engagement.data?.likedByViewer) like.mutate({ id: video.id }); lastTap.current = 0; return; } lastTap.current = now; window.setTimeout(() => { if (lastTap.current === now) togglePlayback(); }, 290); };
  const startHold = () => { holdTimer.current = window.setTimeout(() => { const next = speed === 2 ? 1 : 2; setSpeed(next); if (mediaRef.current) mediaRef.current.playbackRate = next; toast.success(next === 2 ? "2x speed" : "Normal speed"); }, 420); };
  const endHold = () => { if (holdTimer.current) { window.clearTimeout(holdTimer.current); holdTimer.current = null; } };
  const share = async () => { const url = new URL(`/watch/${video.id}`, window.location.origin).toString(); try { if (navigator.share) await navigator.share({ title: video.title, url }); else { await navigator.clipboard.writeText(url); toast.success("Link copied."); } } catch (error) { if ((error as DOMException | undefined)?.name !== "AbortError") toast.error("Unable to share this clip."); } };

  return <article ref={cardRef} className="relative aspect-[9/16] overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl shadow-violet-950/30 max-lg:h-[100dvh] max-lg:w-full max-lg:snap-start max-lg:rounded-none max-lg:border-0">
    <video ref={mediaRef} className="absolute inset-0 size-full object-cover" src={video.videoUrl} poster={video.thumbnailUrl ?? undefined} autoPlay={autoplay} loop muted={muted} preload={dataSaver ? "metadata" : "auto"} playsInline controls={false} onClick={handleTap} onPointerDown={startHold} onPointerUp={endHold} onPointerCancel={endHold} onPlay={() => setPaused(false)} onPause={() => setPaused(true)} onTimeUpdate={event => setProgress(event.currentTarget.duration ? event.currentTarget.currentTime / event.currentTarget.duration * 100 : 0)} />
    {!clearScreen && <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/25" />}
    {!clearScreen && paused && <button type="button" onClick={togglePlayback} className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:scale-105" aria-label="Play clip"><Play className="size-7 fill-current" /></button>}
    {!clearScreen && <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/55 to-transparent px-5 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))] text-sm font-bold text-white"><Link href="/" className="rounded-full bg-black/30 px-3 py-1.5 backdrop-blur">HkTube</Link><div className="flex items-center gap-2"><span className="rounded-full bg-white/10 px-3 py-1.5 backdrop-blur">Clips</span><button type="button" onClick={() => setClearScreen(true)} className="grid size-8 place-items-center rounded-full bg-black/35 backdrop-blur" aria-label="Clear screen"><EyeOff className="size-4" /></button></div></div>}
    {clearScreen && <button type="button" onClick={() => setClearScreen(false)} className="absolute right-4 top-4 z-20 rounded-full bg-black/45 px-3 py-2 text-xs font-semibold text-white backdrop-blur" aria-label="Show clip controls">Show controls</button>}
    {!clearScreen && <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col items-center gap-4">
      <ShortAction icon={Heart} label={formatViews(engagement.data?.likeCount ?? 0)} active={Boolean(engagement.data?.likedByViewer)} onClick={() => { if (requireLogin()) like.mutate({ id: video.id }); }} />
      <ShortAction icon={Bookmark} label="Save" active={false} onClick={() => { if (requireLogin()) save.mutate({ videoId: video.id }); }} />
      <ShortAction icon={MessageCircle} label={String(comments.data?.length ?? 0)} onClick={() => { window.location.href = `/watch/${video.id}`; }} />
      <ShortAction icon={Send} label="Share" onClick={() => void share()} />
      <ShortAction icon={Settings2} label={`${speed}x`} onClick={() => { const next = speed === 2 ? 1 : 2; setSpeed(next); if (mediaRef.current) mediaRef.current.playbackRate = next; }} />
      <div className="relative"><ShortAction icon={MoreVertical} label="More" onClick={() => setShowMenu(value => !value)} />{showMenu && <div className="absolute bottom-0 right-12 min-w-44 rounded-xl border border-white/15 bg-black/90 p-1 text-left text-xs text-white shadow-2xl backdrop-blur"><button type="button" onClick={() => { setClearScreen(true); setShowMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10"><EyeOff className="size-4" />Clear screen</button><button type="button" onClick={() => { if (requireLogin()) report.mutate({ videoId: video.id, reason: "Not interested in this clip" }); setShowMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10">Not interested</button><button type="button" onClick={() => { if (requireLogin()) report.mutate({ videoId: video.id, reason: "User report" }); setShowMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10">Report clip</button><Link href={`/watch/${video.id}`} className="block rounded-lg px-3 py-2 hover:bg-white/10">Open watch page</Link></div>}</div>
    </div>}
    {!clearScreen && <div className="absolute inset-x-4 bottom-5 pr-16"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full border border-white/30 bg-violet-500/60 text-sm font-bold text-white">Hk</span><div className="min-w-0"><p className="font-bold text-white">Published on HkTube</p><p className="text-xs text-slate-300">Published {formatDate(video.uploadedAt)}</p></div></div><h2 className="mt-3 line-clamp-2 text-lg font-bold text-white">{video.title}</h2>{video.description && <p className="mt-1 line-clamp-3 text-sm leading-5 text-slate-200">{video.description}</p>}<div className="mt-4 h-1 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-violet-400 transition-[width] duration-100" style={{ width: `${progress}%` }} /></div></div>}
    {!clearScreen && <button className="absolute bottom-20 left-4 grid size-9 place-items-center rounded-full bg-black/40 text-white" onClick={() => setMuted(value => !value)} aria-label={muted ? "Unmute" : "Mute"}>{muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}</button>}
  </article>;
}

function ShortAction({ icon: Icon, label, onClick, active }: { icon: typeof Heart; label: string; onClick: () => void; active?: boolean }) { return <button onClick={onClick} className="flex flex-col items-center gap-1 text-[11px] font-semibold text-white drop-shadow-md transition hover:scale-105 active:scale-90" aria-label={label}><span className={`grid size-11 place-items-center rounded-full bg-black/45 backdrop-blur ${active ? "text-fuchsia-300" : "text-white"}`}><Icon className={`size-5 ${active ? "fill-current" : ""}`} /></span><span>{label}</span></button>; }
function VideoGridSkeleton() { return <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="animate-pulse"><div className="aspect-video rounded-xl bg-white/5" /><div className="mt-3 h-4 w-4/5 rounded bg-white/6" /><div className="mt-2 h-3 w-1/2 rounded bg-white/5" /></div>)}</div>; }
