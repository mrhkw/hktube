import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatViews, VideoRecord } from "@/lib/video";
import { trpc } from "@/lib/trpc";
import { FileVideo, ImagePlus, Loader2, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { ChangeEvent, FormEvent, useState } from "react";
import { toast } from "sonner";

async function uploadMedia(file: File, kind: "video" | "thumbnail" | "caption") {
  const url = new URL("/api/admin/media-upload", window.location.origin);
  url.searchParams.set("kind", kind);
  url.searchParams.set("filename", file.name);
  url.searchParams.set("contentType", file.type);
  const previewToken = sessionStorage.getItem("manus-cookie");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      ...(previewToken ? { Authorization: `Bearer ${previewToken}` } : {}),
    },
    body: file,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.url) throw new Error(payload?.message || "Upload failed.");
  return payload as { key: string; url: string };
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
  const isAdmin = user?.role === "admin";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"regular" | "shorts">("regular");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [captionFile, setCaptionFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const utils = trpc.useUtils();
  const createMutation = trpc.videos.create.useMutation();
  const videosQuery = trpc.videos.adminList.useQuery(undefined, { enabled: isAdmin });
  const removeMutation = trpc.videos.remove.useMutation({ onSuccess: () => { void utils.videos.adminList.invalidate(); void utils.videos.latest.invalidate(); void utils.videos.shorts.invalidate(); void utils.videos.trending.invalidate(); } });

  async function pickVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setVideoFile(file);
    if (file) setDurationSeconds(await readVideoDuration(file));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin || isSubmitting) return;
    if (!videoFile && !videoUrl.trim()) return toast.error("Choose a video file or provide a video URL.");
    setIsSubmitting(true);
    try {
      const uploadedVideo = videoFile ? await uploadMedia(videoFile, "video") : null;
      const uploadedThumbnail = thumbnailFile ? await uploadMedia(thumbnailFile, "thumbnail") : null;
      const uploadedCaption = captionFile ? await uploadMedia(captionFile, "caption") : null;
      await createMutation.mutateAsync({ title, description, category, durationSeconds, videoUrl: uploadedVideo?.url || videoUrl.trim(), videoStorageKey: uploadedVideo?.key, thumbnailUrl: uploadedThumbnail?.url || thumbnailUrl.trim() || undefined, thumbnailStorageKey: uploadedThumbnail?.key, captionUrl: uploadedCaption?.url, captionStorageKey: uploadedCaption?.key });
      toast.success("Video published to the live HKTUBE catalog.");
      setTitle(""); setDescription(""); setVideoUrl(""); setThumbnailUrl(""); setVideoFile(null); setThumbnailFile(null); setCaptionFile(null); setDurationSeconds(0);
      void utils.videos.adminList.invalidate(); void utils.videos.latest.invalidate(); void utils.videos.shorts.invalidate(); void utils.videos.trending.invalidate();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Video publishing failed."); }
    finally { setIsSubmitting(false); }
  }

  if (loading) return <HkTubeShell><div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-7 animate-spin text-fuchsia-300" /></div></HkTubeShell>;
  if (!user) return <HkTubeShell title="Creator Studio" subtitle="HKTUBE video publishing is available only to the authorized owner account."><AccessNotice button="Sign in as owner" action={startLogin} /></HkTubeShell>;
  if (!isAdmin) return <HkTubeShell title="Creator Studio" subtitle="HKTUBE video publishing is available only to the authorized owner account."><AccessNotice /></HkTubeShell>;

  const managedVideos = (videosQuery.data ?? []) as VideoRecord[];
  return <HkTubeShell title="Creator Studio" subtitle="Publish authentic videos to the HKTUBE database. Uploaded files are saved securely in object storage.">
    <div className="grid gap-7 2xl:grid-cols-[minmax(0,1fr)_410px]">
      <form onSubmit={submit} className="rounded-2xl border border-white/9 bg-[#11111c]/90 p-5 shadow-[0_0_40px_rgba(168,85,247,.07)] sm:p-7">
        <div className="mb-6 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-fuchsia-500/15 text-fuchsia-200"><UploadCloud className="size-5" /></span><div><h2 className="font-bold text-white">Publish a video</h2><p className="text-xs text-slate-500">Nothing is published until you submit this form.</p></div></div>
        <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="title">Video title</Label><Input id="title" required value={title} onChange={event => setTitle(event.target.value)} maxLength={255} className="border-white/10 bg-white/[.045] focus-visible:ring-fuchsia-400/35" /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="description">Description</Label><Textarea id="description" value={description} onChange={event => setDescription(event.target.value)} maxLength={5000} className="min-h-28 border-white/10 bg-white/[.045] focus-visible:ring-fuchsia-400/35" /></div>
          <div className="space-y-2"><Label htmlFor="category">Category</Label><select id="category" value={category} onChange={event => setCategory(event.target.value as "regular" | "shorts")} className="h-10 w-full rounded-md border border-white/10 bg-[#171724] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-fuchsia-400/35"><option value="regular">Regular video</option><option value="shorts">Short</option></select></div><div className="space-y-2"><Label htmlFor="duration">Duration (seconds)</Label><Input id="duration" type="number" min="0" value={durationSeconds} onChange={event => setDurationSeconds(Number(event.target.value) || 0)} className="border-white/10 bg-white/[.045] focus-visible:ring-fuchsia-400/35" /></div>
          <div className="space-y-2"><Label htmlFor="video-file">Video file</Label><Input id="video-file" type="file" accept="video/*" onChange={pickVideo} className="border-white/10 bg-white/[.045] file:mr-3 file:border-0 file:bg-fuchsia-500/15 file:text-fuchsia-100" /><p className="text-[11px] text-slate-500">Choose an authorized video file to store in HKTUBE media storage.</p></div><div className="space-y-2"><Label htmlFor="video-url">Or video URL</Label><Input id="video-url" type="url" value={videoUrl} onChange={event => setVideoUrl(event.target.value)} placeholder="https://..." className="border-white/10 bg-white/[.045] focus-visible:ring-fuchsia-400/35" /><p className="text-[11px] text-slate-500">Use a direct, authorized video URL when no file is selected.</p></div>
          <div className="space-y-2"><Label htmlFor="thumbnail-file">Custom thumbnail file</Label><Input id="thumbnail-file" type="file" accept="image/*" onChange={event => setThumbnailFile(event.target.files?.[0] || null)} className="border-white/10 bg-white/[.045] file:mr-3 file:border-0 file:bg-cyan-400/15 file:text-cyan-100" /></div><div className="space-y-2"><Label htmlFor="thumbnail-url">Or thumbnail URL</Label><Input id="thumbnail-url" type="url" value={thumbnailUrl} onChange={event => setThumbnailUrl(event.target.value)} placeholder="https://..." className="border-white/10 bg-white/[.045] focus-visible:ring-cyan-300/35" /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="caption-file">Caption track (optional)</Label><Input id="caption-file" type="file" accept="text/vtt,.vtt" onChange={event => setCaptionFile(event.target.files?.[0] || null)} className="border-white/10 bg-white/[.045] file:mr-3 file:border-0 file:bg-violet-500/15 file:text-violet-100" /><p className="text-[11px] text-slate-500">Upload an authorized WebVTT (.vtt) caption file to enable the player CC control for this video.</p></div>
        </div>
        <div className="mt-7 flex justify-end"><Button disabled={isSubmitting} className="min-w-36 bg-gradient-to-r from-violet-500 to-fuchsia-500 font-bold text-white hover:from-violet-400 hover:to-fuchsia-400">{isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileVideo className="mr-2 size-4" />}{isSubmitting ? "Publishing" : "Publish video"}</Button></div>
      </form>
      <section className="rounded-2xl border border-cyan-300/12 bg-cyan-300/[.035] p-5"><div className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-cyan-300" /><div><h2 className="font-bold text-cyan-100">Owner-only controls</h2><p className="mt-1 text-sm leading-6 text-slate-400">Your current account has the <strong className="font-semibold text-slate-200">admin</strong> role. Viewer accounts cannot open this screen, create records, upload files, or delete published videos.</p></div></div><div className="mt-5 border-t border-white/8 pt-5"><h3 className="text-xs font-bold uppercase tracking-[.16em] text-slate-400">Publishing checklist</h3><p className="mt-2 text-sm leading-6 text-slate-500">Use content you are authorized to publish. Supply direct media files or URLs, accurate metadata, and a custom thumbnail if appropriate. HKTUBE never substitutes demo imagery or fabricated metrics.</p></div></section>
    </div>
    <section className="mt-9 rounded-2xl border border-white/9 bg-[#11111c]/70 p-5 sm:p-7"><h2 className="text-lg font-bold text-white">Published catalog</h2><p className="mt-1 text-sm text-slate-500">These are the only records currently stored in the HKTUBE database.</p>{videosQuery.isLoading ? <div className="mt-5 space-y-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-white/5" />)}</div> : managedVideos.length ? <div className="mt-5 divide-y divide-white/7">{managedVideos.map(video => <div key={video.id} className="flex items-center gap-4 py-3"><div className="size-12 shrink-0 overflow-hidden rounded-lg bg-violet-500/10">{video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" className="size-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-100">{video.title}</p><p className="mt-1 text-xs text-slate-500">{formatViews(video.viewCount)} <span className="mx-1">•</span>{formatDate(video.uploadedAt)}</p></div><Button variant="ghost" size="icon" disabled={removeMutation.isPending} onClick={() => { if (window.confirm(`Remove “${video.title}” from HKTUBE? This does not delete the stored file.`)) removeMutation.mutate({ id: video.id }); }} className="text-slate-500 hover:bg-red-500/10 hover:text-red-300" aria-label={`Remove ${video.title}`}><Trash2 className="size-4" /></Button></div>)}</div> : <p className="mt-5 text-sm text-slate-500">No videos have been published yet.</p>}</section>
  </HkTubeShell>;
}

function AccessNotice({ button, action }: { button?: string; action?: () => void }) {
  return <div className="mx-auto max-w-lg rounded-2xl border border-fuchsia-400/18 bg-fuchsia-500/[.055] p-7 text-center"><ShieldCheck className="mx-auto size-7 text-fuchsia-200" /><h2 className="mt-3 font-bold text-white">Access restricted</h2><p className="mt-2 text-sm leading-6 text-slate-400">Only the account configured as the HKTUBE owner and admin can publish or manage media.</p>{button && action && <Button onClick={action} className="mt-5 bg-fuchsia-500 text-white hover:bg-fuchsia-400">{button}</Button>}</div>;
}
