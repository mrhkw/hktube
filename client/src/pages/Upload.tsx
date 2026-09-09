import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { FileVideo, ImagePlus, Loader2, Play, ShieldCheck, UploadCloud, X } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const MAX_VIDEO_BYTES = 900 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 12 * 1024 * 1024;
const MAX_CAPTION_BYTES = 2 * 1024 * 1024;

async function getVideoMeta(file: File) {
  return new Promise<{ duration: number; width: number; height: number }>((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve({ duration: Math.floor(video.duration || 0), width: video.videoWidth, height: video.videoHeight }); };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This video file could not be read by the browser.")); };
    video.src = url;
  });
}

function friendlyUploadError(error: unknown) {
  const message = error instanceof Error ? error.message : "Publishing failed.";
  if (/not configured|archive\.org/i.test(message)) return "Video storage is not configured yet. Please contact the HkTube administrator.";
  if (/session expired|sign in/i.test(message)) return "Your session expired. Sign in again, then retry the upload.";
  return message;
}

async function directUpload(file: File, kind: "video" | "thumbnail" | "caption", onProgress: (value: number) => void) {
  const limit = kind === "video" ? MAX_VIDEO_BYTES : kind === "thumbnail" ? MAX_THUMBNAIL_BYTES : MAX_CAPTION_BYTES;
  if (!file.size || file.size > limit) throw new Error(`${kind === "video" ? "Video" : kind === "thumbnail" ? "Thumbnail" : "Caption"} file is too large.`);
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error("Your session expired. Please sign in again.");
  const response = await fetch("/api/media-upload/presign", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ kind, filename: file.name, contentType: file.type, size: file.size }) });
  const payload = await response.json().catch(() => null) as { url?: string; key?: string; publicUrl?: string; message?: string } | null;
  if (!response.ok || !payload?.url || !payload.key || !payload.publicUrl) throw new Error(payload?.message || `Could not prepare the ${kind} upload (HTTP ${response.status}).`);
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", payload.url!);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`Storage upload failed (${request.status}).`));
    request.onerror = () => reject(new Error("Network error while uploading the file."));
    request.send(file);
  });
  return { key: payload.key, url: payload.publicUrl };
}

export default function Upload() {
  const { user, loading } = useAuth();
  const channelsQuery = trpc.channels.mine.useQuery(undefined, { enabled: Boolean(user) });
  const utils = trpc.useUtils();
  const create = trpc.videos.create.useMutation();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const captionInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<"regular" | "shorts">(() => new URLSearchParams(window.location.search).get("category") === "shorts" ? "shorts" : "regular");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [channelId, setChannelId] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [captionFile, setCaptionFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [dimensions, setDimensions] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => () => { if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl); }, [videoPreviewUrl]);

  function openPicker() { videoInputRef.current?.click(); }

  async function pickVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    if (!file.type.startsWith("video/")) { toast.error("Please select a video file."); return; }
    setVideoFile(file);
    setTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim());
    setDuration(0);
    setDimensions("");
    setVideoPreviewUrl(current => { if (current) URL.revokeObjectURL(current); return URL.createObjectURL(file); });
    try {
      const meta = await getVideoMeta(file);
      setDuration(meta.duration);
      setDimensions(`${meta.width}×${meta.height}`);
      if (category === "shorts" && (meta.duration > 180 || meta.width / Math.max(meta.height, 1) > 0.72)) toast.error("Clips must be vertical 9:16 style and no longer than 180 seconds.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not read the video."); }
  }

  function clearVideo() {
    setVideoFile(null); setVideoPreviewUrl(current => { if (current) URL.revokeObjectURL(current); return null; }); setDuration(0); setDimensions("");
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return startLogin();
    if (submitting) return;
    if (channelsQuery.isError) return toast.error("Your channels could not be loaded. Use Retry, then try again.");
    if (!channelsQuery.data?.length) return toast.error("Create a channel first, then publish the video.");
    if (!channelId) return toast.error("Choose your channel.");
    if (!videoFile) return toast.error("Choose a video file.");
    if (!title.trim()) return toast.error("Enter a video title.");
    if (category === "shorts") {
      if (duration > 180) return toast.error("Clips can be up to 180 seconds.");
      if (dimensions) { const [w, h] = dimensions.split("×").map(Number); if (w / Math.max(h, 1) > 0.72) return toast.error("Clip video must be vertical (9:16 style)."); }
    }
    setSubmitting(true);
    try {
      setProgress(0);
      const uploadedVideo = await directUpload(videoFile, "video", setProgress);
      const uploadedThumbnail = thumbnailFile ? await directUpload(thumbnailFile, "thumbnail", setProgress) : null;
      const uploadedCaption = captionFile ? await directUpload(captionFile, "caption", setProgress) : null;
      await create.mutateAsync({ title: title.trim(), description: description.trim(), category, channelId: Number(channelId), durationSeconds: duration, videoUrl: uploadedVideo.url, videoStorageKey: uploadedVideo.key, thumbnailUrl: uploadedThumbnail?.url, thumbnailStorageKey: uploadedThumbnail?.key, captionUrl: uploadedCaption?.url, captionStorageKey: uploadedCaption?.key });
      await Promise.all([utils.videos.latest.invalidate(), utils.videos.shorts.invalidate(), utils.videos.trending.invalidate()]);
      toast.success(category === "shorts" ? "Clip published successfully." : "Video published successfully.");
      setTitle(""); setDescription(""); clearVideo(); setThumbnailFile(null); setCaptionFile(null); setChannelId("");
      if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
      if (captionInputRef.current) captionInputRef.current.value = "";
    } catch (error) { toast.error(friendlyUploadError(error)); }
    finally { setSubmitting(false); setProgress(null); }
  }

  if (loading) return <HkTubeShell><div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-7 animate-spin" /></div></HkTubeShell>;
  if (!user) return <HkTubeShell title="Upload video"><div className="mx-auto max-w-xl rounded-3xl border border-neutral-200 bg-white p-8 text-center"><h1 className="text-2xl font-bold">Sign in to publish</h1><p className="mt-3 text-sm text-neutral-500">You need an authenticated HkTube account and your own channel.</p><Button onClick={startLogin} className="mt-6 bg-black text-white">Sign in / Sign up</Button></div></HkTubeShell>;

  return <HkTubeShell title="Upload video" subtitle={videoFile ? "Review your video, add the details and publish." : "First choose your video. Nothing else opens before you select it."}>
    <div className="mx-auto max-w-4xl pb-8">
      {!videoFile ? <section className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm sm:p-10">
        <input ref={videoInputRef} id="video" type="file" accept="video/*" onChange={pickVideo} className="sr-only" />
        <button type="button" onClick={openPicker} className="group flex min-h-[54vh] w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-neutral-300 bg-neutral-50 px-6 text-center transition hover:border-neutral-500 hover:bg-neutral-100 active:scale-[.995]">
          <span className="grid size-16 place-items-center rounded-2xl bg-black text-white shadow-lg"><UploadCloud className="size-7" /></span>
          <h1 className="mt-6 text-2xl font-black text-neutral-950 sm:text-3xl">Select a video</h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">Your phone's normal video picker will open first. After you select a video, HkTube will show its preview, thumbnail options, title and publishing details.</p>
          <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-bold text-white"><Play className="size-4" /> Choose video</span>
          <p className="mt-4 text-xs text-neutral-400">MP4, WebM, MOV and other browser-supported video formats · max 900 MB</p>
        </button>
      </section> : <form onSubmit={submit} className="space-y-5">
        <section className="overflow-hidden rounded-[28px] border border-neutral-200 bg-black shadow-sm">
          <div className="relative aspect-video w-full bg-neutral-950 sm:aspect-[16/8]"><video src={videoPreviewUrl || undefined} controls playsInline preload="metadata" className="size-full object-contain" /> <button type="button" onClick={clearVideo} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/70 text-white backdrop-blur hover:bg-black" aria-label="Remove selected video"><X className="size-4" /></button></div>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-xs text-neutral-300"><span className="font-semibold text-white">{videoFile.name}</span><span>·</span><span>{Math.round(videoFile.size / 1024 / 1024)} MB</span>{dimensions && <><span>·</span><span>{dimensions}</span></>}{duration > 0 && <><span>·</span><span>{duration}s</span></>}</div>
        </section>

        <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-neutral-400">Video details</p><h2 className="mt-1 text-xl font-black text-neutral-950">Make your video ready to publish</h2></div><button type="button" onClick={openPicker} className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50">Change video</button></div>
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-neutral-100 p-1"><button type="button" onClick={() => setCategory("regular")} className={`rounded-xl px-3 py-2 text-sm font-bold ${category === "regular" ? "bg-black text-white" : "text-neutral-600"}`}>Long Video</button><button type="button" onClick={() => setCategory("shorts")} className={`rounded-xl px-3 py-2 text-sm font-bold ${category === "shorts" ? "bg-black text-white" : "text-neutral-600"}`}>Clip</button></div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="title">Title</Label><Input id="title" required value={title} onChange={e => setTitle(e.target.value)} maxLength={255} placeholder="Give your video a clear title" /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="description">Description</Label><Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} maxLength={5000} className="min-h-28" placeholder="Tell viewers what this video is about" /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="channel">Publish to channel</Label>{channelsQuery.isError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p className="font-semibold">Could not load your channels.</p><p className="mt-1">{channelsQuery.error.message || "Please retry."}</p><Button type="button" variant="outline" className="mt-3 border-red-300 bg-white" onClick={() => void channelsQuery.refetch()}>Retry</Button></div> : channelsQuery.data?.length ? <select id="channel" required value={channelId} onChange={e => setChannelId(e.target.value)} className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"><option value="">Choose your channel</option>{channelsQuery.data.map(channel => <option key={channel.id} value={channel.id}>{channel.displayName} (@{channel.handle})</option>)}</select> : <div className="rounded-2xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-600">No channel yet. <Link href="/channel/create" className="font-bold text-black underline">Create channel</Link>.</div>}</div>
            <div className="space-y-2"><Label htmlFor="thumb">Thumbnail</Label><Input ref={thumbnailInputRef} id="thumb" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e => setThumbnailFile(e.target.files?.[0] || null)} /><p className="text-xs text-neutral-500">Optional · max 12 MB.</p></div>
            <div className="space-y-2"><Label htmlFor="caption">Captions</Label><Input ref={captionInputRef} id="caption" type="file" accept="text/vtt,.vtt" onChange={e => setCaptionFile(e.target.files?.[0] || null)} /><p className="text-xs text-neutral-500">Optional WebVTT · max 2 MB.</p></div>
          </div>
          {progress !== null && <div className="mt-6"><div className="mb-2 flex justify-between text-xs font-semibold"><span>Uploading</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full bg-black transition-[width]" style={{ width: `${progress}%` }} /></div></div>}
          <div className="mt-7 flex justify-end"><Button disabled={submitting || channelsQuery.isError || !channelsQuery.data?.length} className="bg-black text-white hover:bg-neutral-800">{submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileVideo className="mr-2 size-4" />}{submitting ? "Publishing…" : "Publish video"}</Button></div>
        </section>
      </form>}

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-xs leading-5 text-neutral-500"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-neutral-700" /><span>HkTube keeps the upload flow simple: select the real video first, then review preview, title, channel, thumbnail and captions. No Creator Studio settings are required before selecting a file.</span></div>
    </div>
  </HkTubeShell>;
}
