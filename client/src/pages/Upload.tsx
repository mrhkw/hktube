import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatViews, VideoRecord } from "@/lib/video";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { FileVideo, ImagePlus, Loader2, RotateCcw, ShieldCheck, Trash2, UploadCloud, Wand2 } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const maxBytesByKind = { video: 250 * 1024 * 1024, thumbnail: 12 * 1024 * 1024, caption: 2 * 1024 * 1024 } as const;

function assertUploadable(file: File, kind: "video" | "thumbnail" | "caption") {
  if (!file.size) throw new Error("Choose a non-empty file.");
  if (file.size > maxBytesByKind[kind]) throw new Error(`${kind === "video" ? "Video" : kind === "thumbnail" ? "Thumbnail" : "Caption"} exceeds the HKTUBE size limit.`);
}

async function uploadMedia(file: File, kind: "video" | "thumbnail" | "caption", onProgress: (progress: number) => void) {
  assertUploadable(file, kind);
  return new Promise<{ key: string; url: string }>((resolve, reject) => {
    const url = new URL("/api/media-upload", window.location.origin);
    url.searchParams.set("kind", kind);
    url.searchParams.set("filename", file.name);
    url.searchParams.set("contentType", file.type);
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.setRequestHeader("Content-Type", "application/octet-stream");
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) request.setRequestHeader("Authorization", `Bearer ${data.session.access_token}`);
      request.send(file);
    }).catch(() => reject(new Error("Your session expired. Please sign in again.")));
    request.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onerror = () => reject(new Error("Network error while uploading media."));
    request.onload = () => {
      const payload = (() => { try { return JSON.parse(request.responseText); } catch { return null; } })();
      if (request.status < 200 || request.status >= 300 || !payload?.url) reject(new Error(payload?.message || "Upload failed."));
      else resolve(payload as { key: string; url: string });
    };
  });
}

async function readVideoDuration(file: File) {
  return new Promise<number>(resolve => {
    const element = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    element.preload = "metadata";
    element.onloadedmetadata = () => { URL.revokeObjectURL(objectUrl); resolve(Math.floor(element.duration || 0)); };
    element.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(0); };
    element.src = objectUrl;
  });
}

export default function Upload() {
  const { user, loading } = useAuth();
  const isCreator = Boolean(user);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"regular" | "shorts">(() => new URLSearchParams(window.location.search).get("category") === "shorts" ? "shorts" : "regular");
  const [channelId, setChannelId] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [captionFile, setCaptionFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rotation, setRotation] = useState(0);
  const utils = trpc.useUtils();
  const createMutation = trpc.videos.create.useMutation();
  const videosQuery = trpc.videos.adminList.useQuery(undefined, { enabled: user?.role === "admin" });
  const channelsQuery = trpc.channels.mine.useQuery(undefined, { enabled: isCreator });
  const removeMutation = trpc.videos.remove.useMutation({ onSuccess: () => { void utils.videos.adminList.invalidate(); void utils.videos.latest.invalidate(); void utils.videos.shorts.invalidate(); void utils.videos.trending.invalidate(); } });

  async function pickVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setVideoFile(file);
    if (file) setDurationSeconds(await readVideoDuration(file));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isCreator || isSubmitting) return;
    if (!videoFile && !videoUrl.trim()) return toast.error("Choose a video file or provide a video URL.");
    if (!channelId) return toast.error("Choose the channel that owns this upload, or create a channel first.");
    setIsSubmitting(true);
    try {
      const uploadedVideo = videoFile ? await uploadMedia(videoFile, "video", setUploadProgress) : null;
      const uploadedThumbnail = thumbnailFile ? await uploadMedia(thumbnailFile, "thumbnail", setUploadProgress) : null;
      const uploadedCaption = captionFile ? await uploadMedia(captionFile, "caption", setUploadProgress) : null;
      await createMutation.mutateAsync({ title, description, category, channelId: Number(channelId), durationSeconds, videoUrl: uploadedVideo?.url || videoUrl.trim(), videoStorageKey: uploadedVideo?.key, thumbnailUrl: uploadedThumbnail?.url || thumbnailUrl.trim() || undefined, thumbnailStorageKey: uploadedThumbnail?.key, captionUrl: uploadedCaption?.url, captionStorageKey: uploadedCaption?.key });
      toast.success("Video published to the live HKTUBE catalog.");
      setTitle(""); setDescription(""); setVideoUrl(""); setThumbnailUrl(""); setChannelId(""); setVideoFile(null); setThumbnailFile(null); setCaptionFile(null); setDurationSeconds(0);
      void utils.videos.adminList.invalidate(); void utils.videos.latest.invalidate(); void utils.videos.shorts.invalidate(); void utils.videos.trending.invalidate();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Video publishing failed."); }
    finally { setIsSubmitting(false); setUploadProgress(null); }
  }

  if (loading) return <HkTubeShell><div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-7 animate-spin text-fuchsia-300" /></div></HkTubeShell>;
  if (!user) return <HkTubeShell title="Creator Studio" subtitle="Create authentic videos, Shorts, and posts from your own HkTube channel."><AccessNotice button="Sign in to publish" action={startLogin} /></HkTubeShell>;

  const managedVideos = (videosQuery.data ?? []) as VideoRecord[];
  return <HkTubeShell title="Creator Studio" subtitle="Publish authentic videos to the HKTUBE database. Uploaded files are saved securely in object storage.">
    <div className="grid gap-7 2xl:grid-cols-[minmax(0,1fr)_410px]">
      <form onSubmit={submit} className="rounded-2xl border border-white/9 bg-[#11111c]/90 p-5 shadow-[0_0_40px_rgba(168,85,247,.07)] sm:p-7">
        <div className="mb-6 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-fuchsia-500/15 text-fuchsia-200"><UploadCloud className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="font-bold text-white">Publish a video</h2><p className="text-xs text-slate-500">Nothing is published until you submit this form.</p></div><Link href="/studio/ai" className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/20 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-300/10"><Wand2 className="size-3.5" />Creator AI</Link></div>
        {(videoFile || videoUrl) && <EditorPanel file={videoFile} url={videoUrl} category={category} duration={durationSeconds} editorOpen={editorOpen} setEditorOpen={setEditorOpen} trimStart={trimStart} setTrimStart={setTrimStart} trimEnd={trimEnd || durationSeconds} setTrimEnd={setTrimEnd} playbackRate={playbackRate} setPlaybackRate={setPlaybackRate} muted={muted} setMuted={setMuted} rotation={rotation} setRotation={setRotation} />}
        <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="title">Video title</Label><Input id="title" required value={title} onChange={event => setTitle(event.target.value)} maxLength={255} className="border-white/10 bg-white/[.045] focus-visible:ring-fuchsia-400/35" /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="description">Description</Label><Textarea id="description" value={description} onChange={event => setDescription(event.target.value)} maxLength={5000} className="min-h-28 border-white/10 bg-white/[.045] focus-visible:ring-fuchsia-400/35" /></div>
          <div className="space-y-2"><Label htmlFor="category">Category</Label><select id="category" value={category} onChange={event => setCategory(event.target.value as "regular" | "shorts")} className="h-10 w-full rounded-md border border-white/10 bg-[#171724] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-fuchsia-400/35"><option value="regular">Regular video</option><option value="shorts">Short</option></select></div><div className="space-y-2"><Label htmlFor="duration">Duration (seconds)</Label><Input id="duration" type="number" min="0" value={durationSeconds} onChange={event => setDurationSeconds(Number(event.target.value) || 0)} className="border-white/10 bg-white/[.045] focus-visible:ring-fuchsia-400/35" /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="channel">Publish to channel</Label>{channelsQuery.data?.length ? <select id="channel" required value={channelId} onChange={event => setChannelId(event.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-[#171724] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-fuchsia-400/35"><option value="">Choose your channel</option>{channelsQuery.data.map(channel => <option key={channel.id} value={channel.id}>{channel.displayName} (@{channel.handle})</option>)}</select> : <div className="rounded-xl border border-amber-300/15 bg-amber-300/[.05] p-3 text-sm text-amber-100">No channel exists yet. <Link href="/channel/create" className="font-bold text-fuchsia-200 hover:text-fuchsia-100">Create your channel first</Link>.</div>}</div>
          <div className="space-y-2"><Label htmlFor="video-file">Video file</Label><Input id="video-file" type="file" accept="video/*" onChange={pickVideo} className="border-white/10 bg-white/[.045] file:mr-3 file:border-0 file:bg-fuchsia-500/15 file:text-fuchsia-100" /><p className="text-[11px] text-slate-500">Choose an authorized video file to store in HKTUBE media storage.</p></div><div className="space-y-2"><Label htmlFor="video-url">Or video URL</Label><Input id="video-url" type="url" value={videoUrl} onChange={event => setVideoUrl(event.target.value)} placeholder="https://..." className="border-white/10 bg-white/[.045] focus-visible:ring-fuchsia-400/35" /><p className="text-[11px] text-slate-500">Use a direct, authorized video URL when no file is selected.</p></div>
          <div className="space-y-2"><Label htmlFor="thumbnail-file">Custom thumbnail file</Label><Input id="thumbnail-file" type="file" accept="image/*" onChange={event => setThumbnailFile(event.target.files?.[0] || null)} className="border-white/10 bg-white/[.045] file:mr-3 file:border-0 file:bg-cyan-400/15 file:text-cyan-100" /></div><div className="space-y-2"><Label htmlFor="thumbnail-url">Or thumbnail URL</Label><Input id="thumbnail-url" type="url" value={thumbnailUrl} onChange={event => setThumbnailUrl(event.target.value)} placeholder="https://..." className="border-white/10 bg-white/[.045] focus-visible:ring-cyan-300/35" /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="caption-file">Caption track (optional)</Label><Input id="caption-file" type="file" accept="text/vtt,.vtt" onChange={event => setCaptionFile(event.target.files?.[0] || null)} className="border-white/10 bg-white/[.045] file:mr-3 file:border-0 file:bg-violet-500/15 file:text-violet-100" /><p className="text-[11px] text-slate-500">Upload an authorized WebVTT (.vtt) caption file to enable the player CC control for this video.</p></div>
        </div>
        {uploadProgress !== null && <div className="mt-6" aria-live="polite"><div className="mb-2 flex justify-between text-xs text-slate-400"><span>Uploading authorized media</span><span>{uploadProgress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400 transition-[width] duration-200" style={{ width: `${uploadProgress}%` }} /></div></div>}
        <div className="mt-7 flex justify-end"><Button disabled={isSubmitting} className="min-w-36 bg-gradient-to-r from-violet-500 to-fuchsia-500 font-bold text-white hover:from-violet-400 hover:to-fuchsia-400">{isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileVideo className="mr-2 size-4" />}{isSubmitting ? (uploadProgress !== null ? `Uploading ${uploadProgress}%` : "Publishing") : "Publish video"}</Button></div>
      </form>
      <section className="rounded-2xl border border-cyan-300/12 bg-cyan-300/[.035] p-5"><div className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-cyan-300" /><div><h2 className="font-bold text-cyan-100">Owner-only controls</h2><p className="mt-1 text-sm leading-6 text-slate-400">Signed-in creators can publish to channels they own. Catalog deletion and moderation remain restricted to the two configured HkTube owner accounts.</p></div></div><div className="mt-5 border-t border-white/8 pt-5"><h3 className="text-xs font-bold uppercase tracking-[.16em] text-slate-400">Publishing checklist</h3><p className="mt-2 text-sm leading-6 text-slate-500">Use content you are authorized to publish. Supply direct media files or URLs, accurate metadata, and a custom thumbnail if appropriate. HKTUBE never substitutes demo imagery or fabricated metrics.</p></div></section>
    </div>
    <section className="mt-9 rounded-2xl border border-white/9 bg-[#11111c]/70 p-5 sm:p-7"><h2 className="text-lg font-bold text-white">Published catalog</h2><p className="mt-1 text-sm text-slate-500">These are the only records currently stored in the HKTUBE database.</p>{videosQuery.isLoading ? <div className="mt-5 space-y-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-white/5" />)}</div> : managedVideos.length ? <div className="mt-5 divide-y divide-white/7">{managedVideos.map(video => <div key={video.id} className="flex items-center gap-4 py-3"><div className="size-12 shrink-0 overflow-hidden rounded-lg bg-violet-500/10">{video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" className="size-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-100">{video.title}</p><p className="mt-1 text-xs text-slate-500">{formatViews(video.viewCount)} <span className="mx-1">•</span>{formatDate(video.uploadedAt)}</p></div><Button variant="ghost" size="icon" disabled={removeMutation.isPending} onClick={() => { if (window.confirm(`Remove “${video.title}” from HKTUBE? This does not delete the stored file.`)) removeMutation.mutate({ id: video.id }); }} className="text-slate-500 hover:bg-red-500/10 hover:text-red-300" aria-label={`Remove ${video.title}`}><Trash2 className="size-4" /></Button></div>)}</div> : <p className="mt-5 text-sm text-slate-500">No videos have been published yet.</p>}</section>
  </HkTubeShell>;
}

function AccessNotice({ button, action }: { button?: string; action?: () => void }) {
  return <div className="mx-auto max-w-lg rounded-2xl border border-fuchsia-400/18 bg-fuchsia-500/[.055] p-7 text-center"><ShieldCheck className="mx-auto size-7 text-fuchsia-200" /><h2 className="mt-3 font-bold text-white">Access restricted</h2><p className="mt-2 text-sm leading-6 text-slate-400">Only the account configured as the HKTUBE owner and admin can publish or manage media.</p>{button && action && <Button onClick={action} className="mt-5 bg-fuchsia-500 text-white hover:bg-fuchsia-400">{button}</Button>}</div>;
}

type EditorProps = { file: File | null; url: string; category: "regular" | "shorts"; duration: number; editorOpen: boolean; setEditorOpen: (open: boolean) => void; trimStart: number; setTrimStart: (value: number) => void; trimEnd: number; setTrimEnd: (value: number) => void; playbackRate: number; setPlaybackRate: (value: number) => void; muted: boolean; setMuted: (value: boolean) => void; rotation: number; setRotation: (value: number) => void };

function EditorPanel({ file, url, category, duration, editorOpen, setEditorOpen, trimStart, setTrimStart, trimEnd, setTrimEnd, playbackRate, setPlaybackRate, muted, setMuted, rotation, setRotation }: EditorProps) {
  const [src, setSrc] = useState(url);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (!file) { setSrc(url); return; } const objectUrl = URL.createObjectURL(file); setSrc(objectUrl); return () => URL.revokeObjectURL(objectUrl); }, [file, url]);
  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = playbackRate; }, [playbackRate]);
  const max = Math.max(duration, 1);
  return <section className="mb-6 overflow-hidden rounded-2xl border border-cyan-300/15 bg-cyan-300/[.035]">
    <button type="button" onClick={() => setEditorOpen(!editorOpen)} className="flex w-full items-center justify-between px-4 py-3 text-left"><span><span className="flex items-center gap-2 text-sm font-bold text-cyan-100"><Wand2 className="size-4" />Edit before publishing</span><span className="mt-1 block text-xs text-slate-500">{category === "shorts" ? "9:16 Short preview" : "16:9 video preview"} · changes apply to the preview and publish step</span></span><span className="text-xs font-semibold text-cyan-200">{editorOpen ? "Hide" : "Open editor"}</span></button>
    {editorOpen && <div className="border-t border-cyan-300/10 p-4"><div className={`mx-auto overflow-hidden rounded-xl bg-black ${category === "shorts" ? "max-w-[220px] aspect-[9/16]" : "aspect-video max-w-2xl"}`}><video ref={videoRef} src={src || undefined} controls playsInline muted={muted} style={{ width: "100%", height: "100%", objectFit: "contain", transform: `rotate(${rotation}deg)` }} /></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-xs text-slate-400">Trim start: {trimStart}s<input type="range" min="0" max={max} value={Math.min(trimStart, max)} onChange={event => setTrimStart(Number(event.target.value))} className="mt-2 w-full accent-fuchsia-400" /></label><label className="text-xs text-slate-400">Trim end: {trimEnd}s<input type="range" min="0" max={max} value={Math.min(Math.max(trimEnd, trimStart), max)} onChange={event => setTrimEnd(Number(event.target.value))} className="mt-2 w-full accent-fuchsia-400" /></label></div><div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setMuted(!muted)}>{muted ? "Unmute" : "Mute"}</Button><select value={playbackRate} onChange={event => setPlaybackRate(Number(event.target.value))} className="h-9 rounded-md border border-white/10 bg-[#171724] px-3 text-xs text-white"><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select><Button type="button" variant="outline" size="sm" onClick={() => setRotation((rotation + 90) % 360)}>Rotate</Button><Button type="button" variant="ghost" size="sm" onClick={() => { setTrimStart(0); setTrimEnd(duration); setPlaybackRate(1); setMuted(false); setRotation(0); }}><RotateCcw className="mr-1.5 size-3.5" />Reset</Button></div></div>}
  </section>;
}
