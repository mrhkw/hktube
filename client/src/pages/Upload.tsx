import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listMySupabaseChannels, type SupabaseChannel } from "@/lib/supabaseChannels";
import { createSupabaseVideo } from "@/lib/supabaseVideos";
import { AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight, FileVideo, Globe2, ImagePlus, Info, Layers3, Loader2, LockKeyhole, MessageSquare, MonitorPlay, Play, ShieldCheck, Sparkles, Tags, UploadCloud, Video, X } from "lucide-react";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type Category = "regular" | "shorts";

function humanizeFileName(name: string) {
  const base = name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
  if (!base || /^[a-f0-9]{24,}$/i.test(base) || /^[a-z0-9-]{20,}$/i.test(base)) return "";
  return base.replace(/\s+/g, " ").slice(0, 120);
}

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
      reject(new Error("This video could not be read by the browser."));
    };
    video.src = url;
  });
}

async function makeThumbnail(file: File): Promise<File | null> {
  return new Promise(resolve => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.muted = true;
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, Math.max(0, video.duration / 3));
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => resolve(blob ? new File([blob], "hktube-auto-thumbnail.jpg", { type: "image/jpeg" }) : null), "image/jpeg", 0.88);
      } catch { resolve(null); }
      finally { URL.revokeObjectURL(url); }
    };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    video.src = url;
  });
}

export default function Upload() {
  const { user, loading } = useAuth();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [channels, setChannels] = useState<SupabaseChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [category, setCategory] = useState<Category>(() => new URLSearchParams(window.location.search).get("category") === "shorts" ? "shorts" : "regular");
  const [language, setLanguage] = useState(() => localStorage.getItem("hktube-language-code") || "en");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [channelId, setChannelId] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [dimensions, setDimensions] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [copyrightStatus, setCopyrightStatus] = useState<"clear" | "review">("clear");
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("public");
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [madeForKids, setMadeForKids] = useState(false);
  const [tags, setTags] = useState("");
  const [publishedOpen, setPublishedOpen] = useState(false);
  const [publishedType, setPublishedType] = useState<"video" | "short">("video");
  const [autoThumb, setAutoThumb] = useState(true);
  const [dragging, setDragging] = useState(false);

  async function loadChannels() {
    if (!user) return;
    setChannelsLoading(true);
    try {
      const result = await listMySupabaseChannels();
      setChannels(result);
      if (!channelId && result[0]) setChannelId(result[0].id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load your channels.");
    } finally { setChannelsLoading(false); }
  }

  useEffect(() => { if (user) void loadChannels(); else setChannelsLoading(false); }, [user?.id]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview); }, [preview, thumbnailPreview]);

  function applyCategoryFromMeta(width: number, height: number, seconds: number) {
    const ratio = width / Math.max(height, 1);
    if (ratio <= 0.72) {
      setCategory("shorts");
      if (seconds > 180) toast.error("This vertical video is over the 180-second Clip limit.");
      return "shorts" as Category;
    }
    if (ratio >= 1.35) {
      setCategory("regular");
      return "regular" as Category;
    }
    toast.error("This frame is too narrow for Long Video and too wide for a 9:16 Clip. Use 16:9 or 9:16.");
    return category;
  }

  async function processVideo(file: File) {
    if (file.size > 900 * 1024 * 1024) return toast.error("Video must be 900 MB or smaller.");
    if (file.type !== "video/mp4") return toast.error("Use MP4/H.264 for reliable HkTube playback.");
    setVideoFile(file);
    setStep(2);
    setTitle(humanizeFileName(file.name));
    setCopyrightStatus(/(youtube|tiktok|instagram|movie|film|song|official|reupload|copyright)/i.test(file.name) ? "review" : "clear");
    setPreview(current => { if (current) URL.revokeObjectURL(current); return URL.createObjectURL(file); });
    try {
      const meta = await getVideoMeta(file);
      setDuration(meta.duration);
      setDimensions(`${meta.width}×${meta.height}`);
      const detected = applyCategoryFromMeta(meta.width, meta.height, meta.duration);
      const generated = await makeThumbnail(file);
      if (generated && autoThumb) {
        setThumbnailFile(generated);
        setThumbnailPreview(current => { if (current) URL.revokeObjectURL(current); return URL.createObjectURL(generated); });
      }
      toast.success(detected === "shorts" ? "Detected vertical Clip format." : "Detected Long Video format.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not inspect the video.");
    }
  }

  async function pickVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) await processVideo(file);
  }

  async function dropVideo(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) await processVideo(file);
  }

  function clearVideo() {
    if (preview) URL.revokeObjectURL(preview);
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setVideoFile(null); setPreview(null); setThumbnailFile(null); setThumbnailPreview(null);
    setDuration(0); setDimensions(""); setStep(1);
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  function setCustomThumbnail(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("Thumbnail must be JPG, PNG or WebP.");
    if (file.size > 10 * 1024 * 1024) return toast.error("Thumbnail must be 10 MB or smaller.");
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setAutoThumb(false); setThumbnailFile(file); setThumbnailPreview(URL.createObjectURL(file));
  }

  function canContinue() {
    if (!videoFile) return false;
    if (!title.trim()) return false;
    if (!channelId) return false;
    if (category === "shorts" && duration > 180) return false;
    if (dimensions) {
      const [width, height] = dimensions.split("×").map(Number);
      const ratio = width / Math.max(height, 1);
      if (category === "shorts" && ratio > 0.72) return false;
      if (category === "regular" && (ratio < 1.35 || ratio > 2.1)) return false;
    }
    return true;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (step < 3) {
      if (step === 1 && !videoFile) return toast.error("Choose a video first.");
      if (step === 2 && !canContinue()) return toast.error("Complete the required upload details before reviewing.");
      setStep(current => current + 1);
      return;
    }
    if (!user) return startLogin();
    if (!channels.length) return toast.error("Create a channel first, then upload.");
    if (!videoFile || !title.trim() || !channelId) return toast.error("Complete the required fields.");
    try {
      setSubmitting(true); setProgress(5);
      await createSupabaseVideo({
        channelId, title: title.trim(), description: description.trim(), file: videoFile,
        thumbnail: thumbnailFile, isShort: category === "shorts", category, language, visibility,
        allowComments: commentsEnabled, madeForKids,
        tags: tags.split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 30),
        onProgress: setProgress
      });
      setPublishedType(category === "shorts" ? "short" : "video");
      setPublishedOpen(true);
      setTitle(""); setDescription(""); setTags(""); setThumbnailFile(null);
      clearVideo(); await loadChannels();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publishing failed. Please retry.");
    } finally { setSubmitting(false); setProgress(null); }
  }

  if (loading) return <HkTubeShell><div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-7 animate-spin text-violet-300" /></div></HkTubeShell>;
  if (!user) return <HkTubeShell title="Upload"><div className="mx-auto max-w-xl px-5 py-16 text-center"><UploadCloud className="mx-auto size-12 text-violet-400" /><h1 className="mt-5 text-3xl font-black text-white">Sign in to publish</h1><p className="mt-3 text-sm text-slate-400">You need an authenticated account and your own channel.</p><Button onClick={startLogin} className="mt-6 rounded-full bg-violet-500 text-white">Sign in / Sign up</Button></div></HkTubeShell>;

  const formatDuration = duration >= 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s`;
  const recommendation = category === "shorts"
    ? { title: "Clip / Short", ratio: "9:16", reason: "Vertical videos are designed for swipe-first mobile viewing.", icon: MonitorPlay }
    : { title: "Long Video", ratio: "16:9", reason: "Landscape videos get the full player, chapters, captions and long-form discovery.", icon: Video };
  const RecommendationIcon = recommendation.icon;

  return <HkTubeShell title="Upload" subtitle="Create once, then let HkTube validate the media, guide the format and prepare it for moderation.">
    <main className="mx-auto max-w-6xl space-y-5 px-3 pb-12 sm:px-6">
      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-violet-500/[.16] via-[#121827] to-cyan-400/[.08] p-5 shadow-2xl shadow-black/20 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-200">HkTube Creator Upload</p><h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">Upload the right format the first time.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">HkTube checks size, dimensions, duration, thumbnail and publishing settings before the real upload. No guessing based on filename.</p></div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 lg:w-72"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><RecommendationIcon className="size-5"/></span><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Recommended for this file</p><p className="font-black text-white">{recommendation.title} · {recommendation.ratio}</p></div></div><p className="mt-2 text-xs leading-5 text-slate-400">{recommendation.reason}</p></div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <button type="button" onClick={()=>setCategory("regular")} className={`rounded-2xl border p-4 text-left transition ${category==="regular"?"border-violet-400/60 bg-violet-500/15":"border-white/10 bg-black/15 hover:bg-white/[.04]"}`}><div className="flex items-center justify-between"><Video className="size-5 text-violet-200"/>{category==="regular"&&<Check className="size-4 text-violet-200"/>}</div><p className="mt-3 font-black text-white">Long Video</p><p className="mt-1 text-xs leading-5 text-slate-400">Landscape · 16:9 · full player</p></button>
          <button type="button" onClick={()=>setCategory("shorts")} className={`rounded-2xl border p-4 text-left transition ${category==="shorts"?"border-fuchsia-400/60 bg-fuchsia-500/15":"border-white/10 bg-black/15 hover:bg-white/[.04]"}`}><div className="flex items-center justify-between"><MonitorPlay className="size-5 text-fuchsia-200"/>{category==="shorts"&&<Check className="size-4 text-fuchsia-200"/>}</div><p className="mt-3 font-black text-white">Short / Clip</p><p className="mt-1 text-xs leading-5 text-slate-400">Vertical · 9:16 · swipe feed</p></button>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[.06] p-4"><div className="flex items-center gap-2 text-cyan-200"><Sparkles className="size-4"/><span className="text-xs font-black uppercase tracking-wider">Auto recommendation</span></div><p className="mt-3 text-sm font-bold text-white">Drop the file and HkTube detects it.</p><p className="mt-1 text-xs leading-5 text-slate-400">Vertical → Clip. Landscape → Long Video. Ambiguous aspect ratios are flagged instead of silently misclassifying them.</p></div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/8 bg-[#111622] p-3"><div className="grid grid-cols-3 gap-2">{["Choose media","Details","Final review"].map((label,i)=><div key={label} className="flex items-center gap-2 rounded-xl p-2"><span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-black ${step>=i+1?"bg-violet-500 text-white":"bg-white/8 text-slate-500"}`}>{step>i+1?<Check className="size-4"/>:i+1}</span><span className={`hidden text-xs font-bold sm:block ${step>=i+1?"text-white":"text-slate-500"}`}>{label}</span></div>)}</div></section>

      {!videoFile ? <section onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={dropVideo} className={`rounded-[30px] border-2 border-dashed p-6 transition sm:p-10 ${dragging?"border-violet-400 bg-violet-500/10":"border-white/10 bg-[#111622]"}`}>
        <input ref={videoInputRef} type="file" accept="video/mp4" onChange={pickVideo} className="sr-only"/>
        <button type="button" onClick={()=>videoInputRef.current?.click()} className="flex min-h-[40vh] w-full flex-col items-center justify-center rounded-[24px] bg-white/[.025] px-5 text-center hover:bg-white/[.04]">
          <span className="grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-xl"><UploadCloud className="size-9"/></span>
          <h2 className="mt-6 text-2xl font-black text-white">Choose or drag your video here</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">MP4/H.264 only · maximum 900 MB · HkTube reads the actual resolution and duration before storage upload.</p>
          <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-black"><Play className="size-4"/>Select video</span>
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-[11px] font-semibold text-slate-500"><span className="rounded-full border border-white/8 px-3 py-1.5">Long 16:9</span><span className="rounded-full border border-white/8 px-3 py-1.5">Clip 9:16</span><span className="rounded-full border border-white/8 px-3 py-1.5">Auto thumbnail</span><span className="rounded-full border border-white/8 px-3 py-1.5">Moderation</span></div>
        </button>
      </section> :
      <form onSubmit={submit} className="space-y-5">
        <section className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black">
            <div className={`relative bg-black ${category==="shorts"?"aspect-[9/16] max-h-[620px]":"aspect-video"}`}><video src={preview||undefined} controls playsInline preload="metadata" className="size-full object-contain"/><button type="button" onClick={clearVideo} className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-black/70 text-white" aria-label="Remove video"><X className="size-4"/></button></div>
            <div className="flex flex-wrap items-center gap-2 border-t border-white/8 px-4 py-3 text-xs text-slate-400"><span className="font-bold text-white">{videoFile.name}</span><span>·</span><span>{Math.round(videoFile.size/1024/1024)} MB</span>{dimensions&&<><span>·</span><span>{dimensions}</span></>}{duration>0&&<><span>·</span><span>{formatDuration}</span></>}</div>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-violet-400/20 bg-violet-500/[.08] p-4"><div className="flex items-center gap-2 text-violet-200"><Sparkles className="size-4"/><span className="text-xs font-black uppercase tracking-wider">HkTube recommendation</span></div><p className="mt-2 text-lg font-black text-white">{recommendation.title}</p><p className="mt-1 text-xs leading-5 text-slate-400">{recommendation.reason}</p></div>
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={()=>setCategory("regular")} className={`rounded-xl border p-3 text-left text-xs font-bold ${category==="regular"?"border-violet-400/50 bg-violet-500/15 text-white":"border-white/8 text-slate-400"}`}>Long<br/><span className="font-normal text-slate-500">16:9 landscape</span></button><button type="button" onClick={()=>setCategory("shorts")} className={`rounded-xl border p-3 text-left text-xs font-bold ${category==="shorts"?"border-fuchsia-400/50 bg-fuchsia-500/15 text-white":"border-white/8 text-slate-400"}`}>Short / Clip<br/><span className="font-normal text-slate-500">9:16 vertical</span></button></div>
            <div className="rounded-2xl border border-white/8 bg-white/[.025] p-4"><p className="text-xs font-bold text-slate-400">Media check</p><div className="mt-3 space-y-2 text-xs"><CheckLine ok={videoFile.type==="video/mp4"} label="MP4 media" /><CheckLine ok={videoFile.size<=900*1024*1024} label="Within 900 MB limit" /><CheckLine ok={category==="shorts" ? duration<=180 : true} label={category==="shorts"?"Clip duration ≤ 180 seconds":"Long video duration accepted"} /><CheckLine ok={!!dimensions} label="Resolution detected" /></div></div>
          </div>
        </section>

        {step >= 2 && <section className="rounded-[30px] border border-white/10 bg-[#111622] p-5 sm:p-7">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-200">Step 2 · Details</p><h2 className="mt-1 text-2xl font-black text-white">Make the upload discoverable</h2></div><span className="text-xs text-slate-500">Required fields are marked by validation</span></div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2 lg:col-span-2"><div className="flex items-center justify-between"><label htmlFor="title" className="text-sm font-bold text-white">Title</label><span className={`text-xs ${title.length>220?"text-amber-300":"text-slate-500"}`}>{title.length}/255</span></div><Input id="title" required value={title} onChange={e=>setTitle(e.target.value)} maxLength={255} placeholder={category==="shorts"?"Short, clear Clip title":"Clear title that tells viewers what they will watch"} className="h-12 border-white/10 bg-black/20 text-white placeholder:text-slate-600"/></div>
            <div className="space-y-2 lg:col-span-2"><label htmlFor="description" className="text-sm font-bold text-white">Description</label><Textarea id="description" value={description} onChange={e=>setDescription(e.target.value)} maxLength={5000} placeholder="Explain the video, add context, chapters or useful links..." className="min-h-32 border-white/10 bg-black/20 text-white placeholder:text-slate-600"/></div>
            <div className="space-y-2"><label htmlFor="channel" className="text-sm font-bold text-white">Publish to channel</label>{channelsLoading?<div className="rounded-xl border border-white/8 bg-black/20 p-3 text-sm text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin"/>Loading channels…</div>:channels.length?<select id="channel" required value={channelId} onChange={e=>setChannelId(e.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-[#0b0f17] px-3 text-sm text-white">{channels.map(item=><option key={item.id} value={item.id}>{item.displayName} · @{item.handle}</option>)}</select>:<div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-400">No channel. <Link href="/channel/create" className="font-bold text-violet-300 underline">Create one</Link></div>}</div>
            <div className="space-y-2"><label htmlFor="language" className="text-sm font-bold text-white">Language</label><select id="language" value={language} onChange={e=>setLanguage(e.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-[#0b0f17] px-3 text-sm text-white"><option value="en">English</option><option value="ur">Urdu</option><option value="hi">Hindi</option><option value="ar">Arabic</option><option value="other">Other</option></select></div>
            <div className="space-y-2 lg:col-span-2"><label className="text-sm font-bold text-white">Thumbnail</label><div className="grid gap-3 sm:grid-cols-[180px_1fr]"><div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">{thumbnailPreview?<img src={thumbnailPreview} alt="Thumbnail preview" className="size-full object-cover"/>:<div className="grid size-full place-items-center text-slate-600"><ImagePlus/></div>}</div><div className="flex flex-col justify-center gap-2"><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={()=>thumbnailInputRef.current?.click()} className="border-white/10 text-white hover:bg-white/5"><ImagePlus className="mr-2 size-4"/>Choose custom</Button><Button type="button" variant="outline" onClick={async()=>{if(!videoFile)return;const generated=await makeThumbnail(videoFile);if(generated){if(thumbnailPreview)URL.revokeObjectURL(thumbnailPreview);setThumbnailFile(generated);setThumbnailPreview(URL.createObjectURL(generated));setAutoThumb(true);toast.success("New frame generated.");}}} className="border-white/10 text-white hover:bg-white/5">Generate frame</Button><input ref={thumbnailInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e=>setCustomThumbnail(e.target.files?.[0])}/></div><p className="text-xs leading-5 text-slate-500">{autoThumb?"HkTube generated a frame from your video.":"Custom thumbnail selected."} JPG/PNG/WebP · max 10 MB.</p></div></div></div>
            <div className="space-y-2 lg:col-span-2"><label htmlFor="tags" className="flex items-center gap-2 text-sm font-bold text-white"><Tags className="size-4"/>Tags</label><Input id="tags" value={tags} onChange={e=>setTags(e.target.value)} maxLength={500} placeholder="gaming, tutorial, Pakistan, tech" className="h-12 border-white/10 bg-black/20 text-white placeholder:text-slate-600"/><p className="text-xs text-slate-500">Use relevant terms only. Tags influence discovery context, not guaranteed ranking.</p></div>
            <div className="space-y-2"><label className="text-sm font-bold text-white">Visibility</label><div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">{([["public","Public","Search & discovery"],["unlisted","Unlisted","Link access"],["private","Private","Only you"]] as const).map(([value,label,desc])=><button type="button" key={value} onClick={()=>setVisibility(value)} className={`rounded-xl border p-3 text-left ${visibility===value?"border-violet-400/50 bg-violet-500/10":"border-white/8 bg-black/10"}`}><div className="flex items-center gap-2 text-sm font-bold text-white">{value==="public"?<Globe2 className="size-4"/>:<LockKeyhole className="size-4"/>}{label}</div><p className="mt-1 text-[11px] text-slate-500">{desc}</p></button>)}</div></div>
            <div className="space-y-2"><label className="text-sm font-bold text-white">Audience & comments</label><button type="button" onClick={()=>setMadeForKids(v=>!v)} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-white/8 bg-black/10 px-3 text-left text-xs text-slate-300"><span>{madeForKids?"Made for kids":"Not made for kids"}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${madeForKids?"bg-amber-400/15 text-amber-200":"bg-white/5 text-slate-500"}`}>{madeForKids?"ON":"OFF"}</span></button><button type="button" onClick={()=>setCommentsEnabled(v=>!v)} className="mt-2 flex min-h-11 w-full items-center justify-between rounded-xl border border-white/8 bg-black/10 px-3 text-left text-xs text-slate-300"><span className="flex items-center gap-2"><MessageSquare className="size-4"/>{commentsEnabled?"Comments enabled":"Comments disabled"}</span><span className="text-slate-500">{commentsEnabled?"ON":"OFF"}</span></button></div>
          </div>
        </section>}

        {step >= 3 && <section className="rounded-[30px] border border-white/10 bg-[#111622] p-5 sm:p-7"><div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-300"><ShieldCheck/></span><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-200">Step 3 · Final review</p><h2 className="mt-1 text-2xl font-black text-white">Everything ready?</h2><p className="mt-2 text-sm leading-6 text-slate-400">Your real media will be uploaded now. Public discovery remains subject to HkTube moderation.</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Review label="Type" value={category==="shorts"?"Short / Clip":"Long Video"}/><Review label="Format" value={dimensions || "Detected"}/><Review label="Channel" value={channels.find(c=>c.id===channelId)?.displayName || "Selected channel"}/><Review label="Visibility" value={visibility}/></div><div className={`mt-5 rounded-2xl border p-4 text-sm ${copyrightStatus==="review"?"border-amber-400/25 bg-amber-400/[.06] text-amber-100":"border-emerald-400/20 bg-emerald-400/[.05] text-emerald-100"}`}><div className="flex gap-3"><AlertTriangle className={`mt-0.5 size-5 shrink-0 ${copyrightStatus==="review"?"text-amber-300":"text-emerald-300"}`}/><div><p className="font-bold">{copyrightStatus==="review"?"Rights review recommended":"Basic upload checks passed"}</p><p className="mt-1 text-xs leading-5 opacity-80">{copyrightStatus==="review"?"The filename contains terms associated with third-party/reused media. Confirm that you have the rights.":"This is only a basic heuristic. HkTube does not have an external fingerprinting provider connected, so this is not legal copyright clearance."}</p></div></div></div><div className="mt-5 rounded-2xl border border-white/8 bg-black/15 p-4 text-xs leading-5 text-slate-500"><Info className="mr-2 inline size-4"/>Publishing creates the real HkTube video record and uploads the selected file. With public visibility, the content still waits for an approved moderation state before discovery.</div></section>}

        {progress!==null && <section className="rounded-2xl border border-violet-400/20 bg-violet-500/[.06] p-4"><div className="mb-2 flex justify-between text-xs font-bold text-white"><span>Uploading and saving…</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-500 transition-all" style={{width:`${progress}%`}}/></div></section>}

        <div className="sticky bottom-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0d111a]/95 p-3 shadow-2xl backdrop-blur-xl">
          <div className="text-xs text-slate-500"><span className="font-bold text-slate-300">{step===1?"Choose your media":step===2?"Add details":"Final review"}</span><span className="mx-2">·</span>{category==="shorts"?"Vertical Clip":"Long Video"}</div>
          <div className="flex items-center gap-2"><Button type="button" variant="outline" onClick={()=>step===1?clearVideo():setStep(current=>current-1)} disabled={submitting} className="border-white/10 text-white hover:bg-white/5"><ChevronLeft className="mr-1 size-4"/>{step===1?"Remove":"Back"}</Button>{step<3?<Button type="submit" disabled={submitting||channelsLoading||!videoFile} className="bg-violet-500 text-white hover:bg-violet-400">{step===1?"Continue to details":"Review upload"}<ChevronRight className="ml-1 size-4"/></Button>:<Button type="submit" disabled={submitting||channelsLoading||!canContinue()} className="bg-violet-500 text-white hover:bg-violet-400">{submitting?<Loader2 className="mr-2 size-4 animate-spin"/>:<FileVideo className="mr-2 size-4"/>}{submitting?"Publishing…":"Publish to HkTube"}</Button>}</div>
        </div>
      </form>}

      <section className="grid gap-3 sm:grid-cols-3"><Tip icon={Layers3} title="Long videos" text="Use landscape 16:9 for the full HkTube player, chapters and long-form discovery."/><Tip icon={MonitorPlay} title="Shorts / Clips" text="Use vertical 9:16 for the swipe feed. HkTube detects this automatically."/><Tip icon={ShieldCheck} title="Rights & safety" text="Only upload media you have permission to publish. Basic checks are not legal clearance."/></section>
    </main>
    <Dialog open={publishedOpen} onOpenChange={setPublishedOpen}><DialogContent className="border-white/10 bg-[#111522] text-white"><DialogHeader><div className="mx-auto grid size-20 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500"><CheckCircle2 className="size-10 text-white"/></div><DialogTitle className="pt-3 text-center text-2xl font-black">Thanks for publishing!</DialogTitle><DialogDescription className="text-center text-slate-400">{publishedType==="short"?"Your Clip was submitted successfully.":"Your Long Video was submitted successfully."} It is now waiting for moderation before public discovery.</DialogDescription></DialogHeader><div className="mt-3 grid gap-3"><Button type="button" onClick={()=>setPublishedOpen(false)} className="h-11 rounded-full bg-white font-bold text-black hover:bg-slate-100">Upload another</Button><a href="/studio" onClick={()=>setPublishedOpen(false)} className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/[.05] text-sm font-bold text-white">Open Creator Studio</a></div></DialogContent></Dialog>
  </HkTubeShell>;
}

function CheckLine({ ok, label }: { ok: boolean; label: string }) { return <div className="flex items-center gap-2"><span className={`grid size-5 place-items-center rounded-full ${ok?"bg-emerald-500/15 text-emerald-300":"bg-amber-500/15 text-amber-300"}`}>{ok?<Check className="size-3"/>:<AlertTriangle className="size-3"/>}</span><span className="text-slate-300">{label}</span></div>; }
function Review({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/8 bg-black/15 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 truncate text-sm font-bold text-white">{value}</p></div>; }
function Tip({ icon: Icon, title, text }: { icon: typeof Video; title: string; text: string }) { return <div className="rounded-2xl border border-white/8 bg-[#111622] p-4"><Icon className="size-5 text-violet-300"/><p className="mt-3 text-sm font-black text-white">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>; }
