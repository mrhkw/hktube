import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { FileVideo, ImagePlus, Loader2, ShieldCheck, UploadCloud } from "lucide-react";
import { ChangeEvent, FormEvent, useRef, useState } from "react";
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
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({ duration: Math.floor(video.duration || 0), width: video.videoWidth, height: video.videoHeight });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This video file could not be read by the browser."));
    };
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
  const response = await fetch("/api/media-upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ kind, filename: file.name, contentType: file.type, size: file.size }),
  });
  const payload = await response.json().catch(() => null) as { url?: string; key?: string; publicUrl?: string; message?: string } | null;
  if (!response.ok || !payload?.url || !payload.key || !payload.publicUrl) {
    throw new Error(payload?.message || `Could not prepare the ${kind} upload (HTTP ${response.status}).`);
  }
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", payload.url!);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
    };
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve()
      : reject(new Error(`Storage upload failed (${request.status}).`));
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
  const [duration, setDuration] = useState(0);
  const [dimensions, setDimensions] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function pickVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setVideoFile(file);
    setDuration(0);
    setDimensions("");
    if (!file) return;
    try {
      const meta = await getVideoMeta(file);
      setDuration(meta.duration);
      setDimensions(`${meta.width}×${meta.height}`);
      if (category === "shorts" && (meta.duration > 180 || meta.width / Math.max(meta.height, 1) > 0.72)) {
        toast.error("Clips must be vertical 9:16 style and no longer than 180 seconds.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read the video.");
    }
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
      if (dimensions) {
        const [w, h] = dimensions.split("×").map(Number);
        if (w / Math.max(h, 1) > 0.72) return toast.error("Clip video must be vertical (9:16 style).");
      }
    }
    setSubmitting(true);
    try {
      setProgress(0);
      const uploadedVideo = await directUpload(videoFile, "video", setProgress);
      const uploadedThumbnail = thumbnailFile ? await directUpload(thumbnailFile, "thumbnail", setProgress) : null;
      const uploadedCaption = captionFile ? await directUpload(captionFile, "caption", setProgress) : null;
      await create.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        category,
        channelId: Number(channelId),
        durationSeconds: duration,
        videoUrl: uploadedVideo.url,
        videoStorageKey: uploadedVideo.key,
        thumbnailUrl: uploadedThumbnail?.url,
        thumbnailStorageKey: uploadedThumbnail?.key,
        captionUrl: uploadedCaption?.url,
        captionStorageKey: uploadedCaption?.key,
      });
      await Promise.all([utils.videos.latest.invalidate(), utils.videos.shorts.invalidate(), utils.videos.trending.invalidate()]);
      toast.success(category === "shorts" ? "Clip published successfully." : "Video published successfully.");
      setTitle("");
      setDescription("");
      setVideoFile(null);
      setThumbnailFile(null);
      setCaptionFile(null);
      setChannelId("");
      setDuration(0);
      setDimensions("");
      if (videoInputRef.current) videoInputRef.current.value = "";
      if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
      if (captionInputRef.current) captionInputRef.current.value = "";
    } catch (error) {
      toast.error(friendlyUploadError(error));
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  if (loading) return <HkTubeShell><div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-7 animate-spin" /></div></HkTubeShell>;
  if (!user) return <HkTubeShell title="Creator Studio"><div className="mx-auto max-w-xl rounded-3xl border border-neutral-200 bg-white p-8 text-center"><h1 className="text-2xl font-bold">Sign in to publish</h1><p className="mt-3 text-sm text-neutral-500">You need an authenticated HkTube account and your own channel.</p><Button onClick={startLogin} className="mt-6 bg-black text-white">Sign in / Sign up</Button></div></HkTubeShell>;

  return <HkTubeShell title="Creator Studio" subtitle="Publish real videos and Clips directly to HkTube storage.">
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={submit} className="rounded-3xl border border-neutral-200 bg-white p-5 sm:p-7">
        <div className="mb-6 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-black text-white"><UploadCloud className="size-5" /></span><div><h2 className="font-bold">Publish content</h2><p className="text-xs text-neutral-500">Large videos upload directly to storage.</p></div></div>
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-neutral-100 p-1"><button type="button" onClick={() => setCategory("regular")} className={`rounded-xl px-3 py-2 text-sm font-bold ${category === "regular" ? "bg-black text-white" : "text-neutral-600"}`}>Long Video</button><button type="button" onClick={() => setCategory("shorts")} className={`rounded-xl px-3 py-2 text-sm font-bold ${category === "shorts" ? "bg-black text-white" : "text-neutral-600"}`}>Clip</button></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="title">Title</Label><Input id="title" required value={title} onChange={e => setTitle(e.target.value)} maxLength={255} /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="description">Description</Label><Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} maxLength={5000} className="min-h-28" /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="channel">Publish to channel</Label>{channelsQuery.isError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p className="font-semibold">Could not load your channels.</p><p className="mt-1">{channelsQuery.error.message || "Please retry."}</p><Button type="button" variant="outline" className="mt-3 border-red-300 bg-white" onClick={() => void channelsQuery.refetch()}>Retry</Button></div> : channelsQuery.data?.length ? <select id="channel" required value={channelId} onChange={e => setChannelId(e.target.value)} className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"><option value="">Choose your channel</option>{channelsQuery.data.map(channel => <option key={channel.id} value={channel.id}>{channel.displayName} (@{channel.handle})</option>)}</select> : <div className="rounded-2xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-600">No channel yet. <Link href="/channel/create" className="font-bold text-black underline">Create channel</Link>.</div>}</div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="video">Video file</Label><Input ref={videoInputRef} id="video" type="file" accept="video/mp4,video/webm,video/quicktime,video/ogg,video/x-m4v,video/x-msvideo" onChange={pickVideo} /><p className="text-xs text-neutral-500">Maximum 900 MB. {category === "shorts" ? "Clip: vertical 9:16 style, maximum 180 seconds." : "Long video: 16:9 recommended."}</p>{videoFile && <p className="text-xs font-semibold text-neutral-700">{videoFile.name} · {Math.round(videoFile.size / 1024 / 1024)} MB{dimensions ? ` · ${dimensions}` : ""}{duration ? ` · ${duration}s` : ""}</p>}</div>
          <div className="space-y-2"><Label htmlFor="thumb">Thumbnail</Label><Input ref={thumbnailInputRef} id="thumb" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e => setThumbnailFile(e.target.files?.[0] || null)} /><p className="text-xs text-neutral-500">Optional, max 12 MB.</p></div>
          <div className="space-y-2"><Label htmlFor="caption">Captions</Label><Input ref={captionInputRef} id="caption" type="file" accept="text/vtt,.vtt" onChange={e => setCaptionFile(e.target.files?.[0] || null)} /><p className="text-xs text-neutral-500">Optional WebVTT, max 2 MB.</p></div>
        </div>
        {progress !== null && <div className="mt-6"><div className="mb-2 flex justify-between text-xs font-semibold"><span>Uploading</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full bg-black transition-[width]" style={{ width: `${progress}%` }} /></div></div>}
        <div className="mt-7 flex justify-end"><Button disabled={submitting || channelsQuery.isError || !channelsQuery.data?.length} className="bg-black text-white hover:bg-neutral-800">{submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileVideo className="mr-2 size-4" />}{submitting ? "Publishing…" : "Publish"}</Button></div>
      </form>
      <aside className="space-y-4"><section className="rounded-3xl border border-neutral-200 bg-white p-5"><div className="flex gap-3"><ShieldCheck className="size-5 shrink-0" /><div><h2 className="font-bold">Publishing rules</h2><p className="mt-2 text-sm leading-6 text-neutral-500">Only your own channel can receive your uploads. Media is stored separately from the Vercel request.</p></div></div></section><section className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5"><div className="flex gap-3"><ImagePlus className="size-5 shrink-0" /><div><h2 className="font-bold">Clip quality</h2><p className="mt-2 text-sm leading-6 text-neutral-500">Use vertical 9:16 video. Clips accept up to 180 seconds and 900 MB.</p></div></div></section></aside>
    </div>
  </HkTubeShell>;
}
