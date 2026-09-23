import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, FileVideo2, ImagePlus, Loader2, ShieldAlert, UploadCloud, X } from "lucide-react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { listMySupabaseChannels, type SupabaseChannel } from "@/lib/supabaseChannels";
import { createSupabaseVideo } from "@/lib/supabaseVideos";
import { startLogin } from "@/const";

type Notice = { type: "success" | "error"; text: string } | null;

const MAX_VIDEO_BYTES = 900 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 12 * 1024 * 1024;
const ACCEPTED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const ACCEPTED_THUMBNAIL_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function friendlyUploadError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (/row-level security|policy|not authorized|permission denied/i.test(raw)) return "Upload permission denied. Please sign in again and make sure you own the selected channel.";
  if (/bucket|storage object|object not found/i.test(raw)) return "Video storage is not available right now. Please retry in a moment.";
  if (/network|fetch|failed to fetch|timeout|abort/i.test(raw)) return "Network problem while uploading. Check your connection and retry; your source file is still safe.";
  if (/duplicate|already exists/i.test(raw)) return "This upload already exists. Please retry to create a fresh upload.";
  return raw || "Upload failed. Please check the file and try again.";
}

export default function UploadPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [channels, setChannels] = useState<SupabaseChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelError, setChannelError] = useState("");
  const [channelId, setChannelId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [isShort, setIsShort] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("public");
  const [madeForKids, setMadeForKids] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    let active = true;
    if (!isAuthenticated) { setChannelsLoading(false); return; }
    setChannelsLoading(true);
    setChannelError("");
    void listMySupabaseChannels().then(value => {
      if (!active) return;
      setChannels(value);
      setChannelId(current => current || value[0]?.id || "");
    }).catch(error => {
      if (active) setChannelError(friendlyUploadError(error));
    }).finally(() => { if (active) setChannelsLoading(false); });
    return () => { active = false; };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!thumbnail) { setThumbnailPreview(""); return; }
    const url = URL.createObjectURL(thumbnail);
    setThumbnailPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [thumbnail]);

  const selectedChannel = useMemo(() => channels.find(channel => channel.id === channelId), [channels, channelId]);
  const canSubmit = Boolean(!uploading && file && title.trim() && channelId && !channelsLoading);

  function chooseVideo(next: File | undefined) {
    if (!next) return;
    setNotice(null);
    if (!ACCEPTED_VIDEO_TYPES.has(next.type)) {
      setFile(null);
      setNotice({ type: "error", text: "Please choose an MP4 (H.264) or WebM video. MOV/MKV files must be exported first for reliable playback." });
      return;
    }
    if (next.size > MAX_VIDEO_BYTES) {
      setFile(null);
      setNotice({ type: "error", text: `Video must be 900 MB or smaller. This file is ${formatBytes(next.size)}.` });
      return;
    }
    setFile(next);
  }

  function chooseThumbnail(next: File | undefined) {
    if (!next) return;
    setNotice(null);
    if (!ACCEPTED_THUMBNAIL_TYPES.has(next.type)) {
      setThumbnail(null);
      setNotice({ type: "error", text: "Thumbnail must be JPG, PNG, WebP, or AVIF." });
      return;
    }
    if (next.size > MAX_THUMBNAIL_BYTES) {
      setThumbnail(null);
      setNotice({ type: "error", text: `Thumbnail must be 12 MB or smaller. This file is ${formatBytes(next.size)}.` });
      return;
    }
    setThumbnail(next);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isAuthenticated) { startLogin(); return; }
    if (!file) return setNotice({ type: "error", text: "Choose a video before publishing." });
    if (!channelId) return setNotice({ type: "error", text: "Create or select a channel before publishing." });
    if (!title.trim()) return setNotice({ type: "error", text: "Add a title before publishing." });
    if (uploading) return;

    setUploading(true); setProgress(0); setNotice(null);
    try {
      await createSupabaseVideo({
        channelId,
        title: title.trim(),
        description: description.trim(),
        category: category.trim() || null,
        tags: tags.split(",").map(tag => tag.trim()).filter(Boolean),
        file,
        thumbnail,
        isShort,
        visibility,
        madeForKids,
        onProgress: setProgress,
      });
      setNotice({ type: "success", text: visibility === "public" ? "Upload received. Your video is now processing and will appear after moderation." : "Upload saved successfully." });
      setTitle(""); setDescription(""); setCategory(""); setTags(""); setFile(null); setThumbnail(null); setProgress(100);
    } catch (error) {
      setNotice({ type: "error", text: friendlyUploadError(error) });
    } finally { setUploading(false); }
  }

  if (authLoading) return <HkTubeShell title="Upload"><div className="mx-auto grid min-h-[55vh] place-items-center"><Loader2 className="size-7 animate-spin text-violet-300" /></div></HkTubeShell>;
  if (!isAuthenticated) return <HkTubeShell title="Upload"><div className="mx-auto max-w-xl px-5 py-16 text-center"><UploadCloud className="mx-auto size-12 text-violet-300" /><h1 className="mt-5 text-3xl font-black text-white">Sign in to upload</h1><p className="mt-3 text-sm leading-6 text-slate-400">Uploads are connected to your channel and protected by your account.</p><button type="button" onClick={startLogin} className="mt-6 rounded-full bg-violet-500 px-6 py-3 text-sm font-bold text-white hover:bg-violet-400">Sign in / Sign up</button></div></HkTubeShell>;
  if (!channelsLoading && !channels.length) return <HkTubeShell title="Upload"><div className="mx-auto max-w-xl px-5 py-12"><Link href="/" className="inline-flex items-center text-sm font-semibold text-slate-300"><ArrowLeft className="mr-1.5 size-4" />Back to Home</Link><div className="mt-8 rounded-3xl border border-violet-300/15 bg-violet-500/[.05] p-8 text-center"><FileVideo2 className="mx-auto size-10 text-violet-300" /><h1 className="mt-4 text-2xl font-black text-white">Create your channel first</h1><p className="mt-2 text-sm leading-6 text-slate-400">Every upload needs an owner channel so viewers know where it came from.</p>{channelError && <p className="mt-4 rounded-xl bg-rose-500/10 p-3 text-left text-xs text-rose-200">{channelError}</p>}<Link href="/channel/create" className="mt-6 inline-flex rounded-full bg-violet-500 px-5 py-3 text-sm font-bold text-white">Create channel</Link></div></div></HkTubeShell>;

  return <HkTubeShell title="Upload" subtitle="Publish original video safely to your HkTube channel."><main className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-7 lg:px-9"><form onSubmit={submit} className="space-y-5">
    {notice && <div role="alert" className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${notice.type === "success" ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100" : "border-rose-300/20 bg-rose-500/10 text-rose-100"}`}>{notice.type === "success" ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : <ShieldAlert className="mt-0.5 size-5 shrink-0" />}<span>{notice.text}</span></div>}
    <section className="rounded-3xl border border-white/10 bg-white/[.03] p-5 sm:p-7"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">Step 1</p><h1 className="mt-1 text-2xl font-black text-white">Choose your video</h1><p className="mt-2 text-sm text-slate-400">MP4/H.264 or WebM · maximum 900 MB.</p></div><FileVideo2 className="size-8 text-violet-300" /></div><label className="mt-6 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/10 px-5 text-center hover:border-violet-300/50"><UploadCloud className="size-9 text-violet-300" /><span className="mt-3 text-sm font-bold text-white">{file ? file.name : "Choose a video file"}</span><span className="mt-1 text-xs text-slate-500">{file ? formatBytes(file.size) : "Tap to browse from your device"}</span><input type="file" accept="video/mp4,video/webm" className="sr-only" onChange={event => chooseVideo(event.target.files?.[0])} /></label>{file && <button type="button" onClick={() => setFile(null)} className="mt-3 inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white"><X className="mr-1 size-3.5" />Remove video</button>}</section>
    <section className="rounded-3xl border border-white/10 bg-white/[.03] p-5 sm:p-7"><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">Step 2</p><h2 className="mt-1 text-xl font-black text-white">Video details</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><label className="sm:col-span-2"><span className="text-sm font-semibold text-white">Title <b className="text-rose-300">*</b></span><input value={title} onChange={event => setTitle(event.target.value)} maxLength={180} required className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-300/50" placeholder="Give your video a clear title" /></label><label className="sm:col-span-2"><span className="text-sm font-semibold text-white">Description</span><textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={10000} rows={5} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-300/50" placeholder="Tell viewers what this video is about" /></label><label><span className="text-sm font-semibold text-white">Channel</span><select value={channelId} onChange={event => setChannelId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#151a25] px-4 py-3 text-sm text-white outline-none focus:border-violet-300/50">{channels.map(channel => <option key={channel.id} value={channel.id}>{channel.displayName} (@{channel.handle})</option>)}</select></label><label><span className="text-sm font-semibold text-white">Visibility</span><select value={visibility} onChange={event => setVisibility(event.target.value as typeof visibility)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#151a25] px-4 py-3 text-sm text-white outline-none focus:border-violet-300/50"><option value="public">Public · moderation required</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select></label><label><span className="text-sm font-semibold text-white">Category</span><input value={category} onChange={event => setCategory(event.target.value)} maxLength={80} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-300/50" placeholder="Music, gaming, education…" /></label><label><span className="text-sm font-semibold text-white">Tags</span><input value={tags} onChange={event => setTags(event.target.value)} maxLength={500} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-300/50" placeholder="tutorial, tech, vlog" /></label></div></section>
    <section className="rounded-3xl border border-white/10 bg-white/[.03] p-5 sm:p-7"><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">Step 3</p><h2 className="mt-1 text-xl font-black text-white">Playback options</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/10 p-4"><input type="checkbox" checked={isShort} onChange={event => setIsShort(event.target.checked)} className="mt-1 size-4 accent-violet-500" /><span><b className="block text-sm text-white">Upload as Clip</b><span className="mt-1 block text-xs leading-5 text-slate-500">Requires a vertical 9:16 video and is limited to 180 seconds.</span></span></label><label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/10 p-4"><input type="checkbox" checked={madeForKids} onChange={event => setMadeForKids(event.target.checked)} className="mt-1 size-4 accent-violet-500" /><span><b className="block text-sm text-white">Made for kids</b><span className="mt-1 block text-xs leading-5 text-slate-500">Use this only when the content is specifically directed to children.</span></span></label></div><div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4"><div className="flex items-center gap-3"><ImagePlus className="size-5 text-violet-300" /><div><p className="text-sm font-semibold text-white">Custom thumbnail</p><p className="text-xs text-slate-500">Optional · JPG, PNG, WebP or AVIF · maximum 12 MB.</p></div></div><div className="mt-4 flex flex-wrap items-center gap-4"><label className="inline-flex cursor-pointer rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white hover:bg-white/[.06]">{thumbnail ? "Change thumbnail" : "Choose thumbnail"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={event => chooseThumbnail(event.target.files?.[0])} /></label>{thumbnailPreview && <img src={thumbnailPreview} alt="Thumbnail preview" className="h-16 w-28 rounded-lg object-cover" />}{thumbnail && <button type="button" onClick={() => setThumbnail(null)} className="text-xs font-semibold text-slate-400 hover:text-white">Remove</button>}</div></div></section>
    {uploading && <div className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-4"><div className="flex items-center justify-between text-sm font-semibold text-white"><span>Uploading securely…</span><span>{progress}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-violet-400 transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-slate-400">Keep this tab open until the upload finishes.</p></div>}
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{selectedChannel ? `Publishing to ${selectedChannel.displayName}` : "Select a channel to continue."}</p><button type="submit" disabled={!canSubmit} className="inline-flex min-h-12 items-center rounded-full bg-violet-500 px-6 text-sm font-bold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50">{uploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UploadCloud className="mr-2 size-4" />}{uploading ? "Uploading…" : "Publish video"}</button></div>
  </form></main></HkTubeShell>;
}
