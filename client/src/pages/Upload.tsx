import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { ArrowLeft, CheckCircle2, Circle, FileVideo2, ImagePlus, Loader2, PauseCircle, PlayCircle, ShieldCheck, Smartphone, Square, UploadCloud, WandSparkles, X } from "lucide-react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { listMySupabaseChannels, type SupabaseChannel } from "@/lib/supabaseChannels";
import { createSupabaseVideo } from "@/lib/supabaseVideos";
import { startLogin } from "@/const";

type Notice = { type: "success" | "error" | "info"; text: string } | null;
type Step = "media" | "details" | "publish";
type VideoInfo = { width: number; height: number; duration: number };

const MAX_VIDEO_BYTES = 900 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 12 * 1024 * 1024;
const ACCEPTED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const ACCEPTED_THUMBNAIL_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const DRAFT_KEY = "hktube-upload-draft-v2";

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function formatEta(seconds: number | null) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "calculating…";
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s left`;
}

function friendlyUploadError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (/row-level security|policy|not authorized|permission denied/i.test(raw)) return "Upload permission denied. Sign in again and make sure you own the selected channel.";
  if (/bucket|storage object|object not found/i.test(raw)) return "Video storage is not available right now. Retry in a moment.";
  if (/network|fetch|failed to fetch|timeout|abort|interrupted/i.test(raw)) return "The connection interrupted the upload. HkTube uses resumable upload chunks, so reselecting the same file can continue the transfer.";
  if (/duplicate|already exists/i.test(raw)) return "This upload already exists. Choose the file again to start a new upload.";
  return raw || "Upload failed. Check the file and try again.";
}

async function inspectVideo(file: File): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("HkTube could not read this video. Export a standard MP4/H.264 or WebM file."));
    }, 12000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (!video.videoWidth || !video.videoHeight) {
        cleanup();
        reject(new Error("This file does not contain a readable video track."));
        return;
      }
      const duration = Number.isFinite(video.duration) ? Math.max(0, video.duration) : 0;
      const info = { width: video.videoWidth, height: video.videoHeight, duration };
      cleanup();
      resolve(info);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("HkTube could not decode this video. Use a standard MP4/H.264 or WebM export."));
    };
    video.src = url;
  });
}

async function generateThumbnailAt(file: File, info: VideoInfo, position: number): Promise<File | null> {
  return new Promise(resolve => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const canvas = document.createElement("canvas");
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };
    const finish = (value: File | null) => {
      cleanup();
      resolve(value);
    };
    const timeout = window.setTimeout(() => finish(null), 10000);
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(Math.max(info.duration * position, 0.1), Math.max(info.duration - 0.1, 0.1));
    };
    video.onseeked = () => {
      window.clearTimeout(timeout);
      canvas.width = Math.min(info.width, 1280);
      canvas.height = Math.max(1, Math.round(canvas.width * info.height / info.width));
      const ctx = canvas.getContext("2d");
      if (!ctx) return finish(null);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (!blob) return finish(null);
        finish(new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-thumbnail.jpg`, { type: "image/jpeg" }));
      }, "image/jpeg", 0.84);
    };
    video.onerror = () => {
      window.clearTimeout(timeout);
      finish(null);
    };
    video.src = url;
  });
}

async function generateThumbnail(file: File, info: VideoInfo): Promise<File | null> { return generateThumbnailAt(file, info, 0.12); }\nfunction titleFromFilename(name: string) { return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 100); }\nfunction suggestedTags(title: string, category: string) { const words = title.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(word => word.length >= 3); return Array.from(new Set([category.trim().toLowerCase(), ...words].filter(Boolean))).slice(0, 10).join(", "); }\nexport default function UploadPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [channels, setChannels] = useState<SupabaseChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelError, setChannelError] = useState("");
  const [channelId, setChannelId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [language, setLanguage] = useState("English");
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [videoPreview, setVideoPreview] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [isShort, setIsShort] = useState(false);\n  const [uploadMode, setUploadMode] = useState<"video" | "short" | "auto">("auto");\n  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("public");
  const [madeForKids, setMadeForKids] = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [allowDownload, setAllowDownload] = useState(false);
  const [step, setStep] = useState<Step>("media");
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [autoThumbnail, setAutoThumbnail] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);\n  const recorderRef = useRef<MediaRecorder | null>(null);\n  const recordingStreamRef = useRef<MediaStream | null>(null);\n  const recordingVideoRef = useRef<HTMLVideoElement | null>(null);\n  const recordingChunksRef = useRef<Blob[]>([]);\n  const [recording, setRecording] = useState(false);\n  const [recordingSeconds, setRecordingSeconds] = useState(0);\n  const recordingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") as Partial<Record<string, string | boolean>> | null;
      if (!draft) return;
      if (typeof draft.title === "string") setTitle(draft.title);
      if (typeof draft.description === "string") setDescription(draft.description);
      if (typeof draft.category === "string") setCategory(draft.category);
      if (typeof draft.tags === "string") setTags(draft.tags);
      if (typeof draft.language === "string") setLanguage(draft.language);
      if (typeof draft.visibility === "string") setVisibility(draft.visibility as typeof visibility);
      if (typeof draft.madeForKids === "boolean") setMadeForKids(draft.madeForKids);
      if (typeof draft.allowComments === "boolean") setAllowComments(draft.allowComments);
      if (typeof draft.allowDownload === "boolean") setAllowDownload(draft.allowDownload);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, description, category, tags, language, visibility, madeForKids, allowComments, allowDownload }));
  }, [title, description, category, tags, language, visibility, madeForKids, allowComments, allowDownload]);

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

  useEffect(() => {
    if (!file) { setVideoPreview(""); return; }
    const url = URL.createObjectURL(file);
    setVideoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const selectedChannel = useMemo(() => channels.find(channel => channel.id === channelId), [channels, channelId]);
  const canSubmit = Boolean(!uploading && file && title.trim() && channelId && videoInfo && !channelsLoading);
  const modeLabel = isShort ? "Clip" : "Long Video";

  async function chooseVideo(next: File | undefined) {
    if (!next || uploading) return;
    setNotice(null);
    if (!ACCEPTED_VIDEO_TYPES.has(next.type.toLowerCase())) {
      setNotice({ type: "error", text: "Use MP4/H.264 or WebM for reliable playback." });
      return;
    }
    if (next.size <= 0 || next.size > MAX_VIDEO_BYTES) {
      setNotice({ type: "error", text: next.size <= 0 ? "The selected video is empty." : `Video must be 900 MB or smaller. This file is ${formatBytes(next.size)}.` });
      return;
    }
    try {
      const info = await inspectVideo(next);
      const params = new URLSearchParams(window.location.search);
      const forcedShort = params.get("category") === "shorts";
      const inferredShort = info.height >= info.width && info.duration <= 180;
      setFile(next);
      setVideoInfo(info);
      setIsShort(chosenShort);
      setAutoThumbnail(false);
      const generated = await generateThumbnail(next, info);
      if (generated) {
        setThumbnail(generated);
        setAutoThumbnail(true);
      }
      setStep("details");
      if (inferredShort && !forcedShort) setNotice({ type: "info", text: "Portrait video detected. HkTube set this upload to Clip mode automatically." });
    } catch (error) {
      setFile(null);
      setVideoInfo(null);
      setNotice({ type: "error", text: friendlyUploadError(error) });
    }
  }

  async function startRecording() {
    if (recording || uploading) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setNotice({ type: "error", text: "Camera recording is not supported by this browser. Use Choose video instead." });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: true });
      recordingStreamRef.current = stream;
      if (recordingVideoRef.current) {
        recordingVideoRef.current.srcObject = stream;
        await recordingVideoRef.current.play().catch(() => undefined);
      }
      const preferred = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(type => MediaRecorder.isTypeSupported(type)) || "";
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      recordingChunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size) recordingChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "video/webm" });
        const recordedFile = new File([blob], `HkTube-recording-${Date.now()}.webm`, { type: blob.type || "video/webm", lastModified: Date.now() });
        stream.getTracks().forEach(track => track.stop());
        recordingStreamRef.current = null;
        if (recordingVideoRef.current) recordingVideoRef.current.srcObject = null;
        setRecording(false);
        if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
        setRecordingSeconds(0);
        void chooseVideo(recordedFile);
      };
      recorder.onerror = () => {
        stream.getTracks().forEach(track => track.stop());
        recordingStreamRef.current = null;
        setRecording(false);
        setNotice({ type: "error", text: "Camera recording failed. Your browser did not provide a usable recording." });
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => setRecordingSeconds(value => value + 1), 1000);
      setNotice({ type: "info", text: "Recording started. Keep the camera steady. Stop recording when your video is ready." });
    } catch {
      setNotice({ type: "error", text: "Camera or microphone permission was denied. Allow access in the browser or use Choose video." });
    }
  }

  function stopRecording() {
    if (!recorderRef.current || recorderRef.current.state === "inactive") return;
    recorderRef.current.stop();
    recorderRef.current = null;
  }

  function formatRecordingTime(seconds: number) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function chooseThumbnail(next: File | undefined) {
    if (!next || uploading) return;
    setNotice(null);
    if (!ACCEPTED_THUMBNAIL_TYPES.has(next.type.toLowerCase())) {
      setNotice({ type: "error", text: "Thumbnail must be JPG, PNG, WebP, or AVIF." });
      return;
    }
    if (next.size > MAX_THUMBNAIL_BYTES) {
      setNotice({ type: "error", text: `Thumbnail must be 12 MB or smaller. This file is ${formatBytes(next.size)}.` });
      return;
    }
    setAutoThumbnail(false);
    setThumbnail(next);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    void chooseVideo(event.dataTransfer.files?.[0]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isAuthenticated) { startLogin(); return; }
    if (!file || !videoInfo) return setNotice({ type: "error", text: "Choose a valid video first." });
    if (!channelId) return setNotice({ type: "error", text: "Create or select a channel first." });
    if (!title.trim()) return setNotice({ type: "error", text: "Add a title before publishing." });
    if (isShort && videoInfo.duration > 180) return setNotice({ type: "error", text: "Clips are limited to 3 minutes." });
    if (uploading) return;
    setUploading(true);
    setProgress(0);
    setEta(null);
    startedAtRef.current = Date.now();
    abortRef.current = new AbortController();
    setNotice({ type: "info", text: "Preparing a resumable upload. Large files continue in small chunks instead of restarting from zero." });
    try {
      await createSupabaseVideo({
        channelId,
        title: title.trim(),
        description: description.trim(),
        category: category.trim() || null,
        language: language.trim() || null,
        tags: tags.split(",").map(tag => tag.trim()).filter(Boolean),
        file,
        thumbnail,
        isShort,
        visibility,
        madeForKids,
        allowComments,
        allowDownload,
        signal: abortRef.current.signal,
        onProgress: value => {
          setProgress(value);
          const started = startedAtRef.current;
          if (started && value > 2) {
            const elapsed = (Date.now() - started) / 1000;
            const remaining = elapsed * (100 - value) / value;
            setEta(remaining);
          }
        },
      });
      setProgress(100);
      setNotice({ type: "success", text: visibility === "public" ? "Upload complete. Your video is published and linked to your channel." : "Upload complete and saved." });
      localStorage.removeItem(DRAFT_KEY);
      setStep("publish");
      setTitle(""); setDescription(""); setCategory(""); setTags(""); setFile(null); setThumbnail(null); setVideoInfo(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setNotice({ type: "info", text: "Upload paused/cancelled. Select the same file again to continue the resumable transfer." });
      } else {
        setNotice({ type: "error", text: friendlyUploadError(error) });
      }
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  }

  function cancelUpload() {
    abortRef.current?.abort();
  }

  if (authLoading) return <HkTubeShell title="Upload"><div className="mx-auto grid min-h-[55vh] place-items-center"><Loader2 className="size-7 animate-spin text-violet-300" /></div></HkTubeShell>;
  if (!isAuthenticated) return <HkTubeShell title="Upload"><div className="mx-auto max-w-xl px-5 py-16 text-center"><UploadCloud className="mx-auto size-12 text-violet-300" /><h1 className="mt-5 text-3xl font-black text-white">Sign in to upload</h1><p className="mt-3 text-sm leading-6 text-slate-400">Uploads are connected to your channel and protected by your account.</p><button type="button" onClick={startLogin} className="mt-6 rounded-full bg-violet-500 px-6 py-3 text-sm font-bold text-white">Sign in / Sign up</button></div></HkTubeShell>;
  if (!channelsLoading && !channels.length) return <HkTubeShell title="Upload"><div className="mx-auto max-w-xl px-5 py-12"><Link href="/" className="inline-flex items-center text-sm font-semibold text-slate-300"><ArrowLeft className="mr-1.5 size-4" />Back to Home</Link><div className="mt-8 rounded-3xl border border-violet-300/15 bg-violet-500/[.05] p-8 text-center"><FileVideo2 className="mx-auto size-10 text-violet-300" /><h1 className="mt-4 text-2xl font-black text-white">Create your channel first</h1><p className="mt-2 text-sm leading-6 text-slate-400">Every upload needs an owner channel so viewers know where it came from.</p>{channelError && <p className="mt-4 rounded-xl bg-rose-500/10 p-3 text-left text-xs text-rose-200">{channelError}</p>}<Link href="/channel/create" className="mt-6 inline-flex rounded-full bg-violet-500 px-5 py-3 text-sm font-bold text-white">Create channel</Link></div></div></HkTubeShell>;

  return <HkTubeShell title="Create" subtitle="Fast, resumable publishing for long videos and Clips.">
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-7 lg:px-10">
      {notice && <div role="alert" className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 text-sm ${notice.type === "success" ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100" : notice.type === "error" ? "border-rose-300/20 bg-rose-500/10 text-rose-100" : "border-sky-300/20 bg-sky-500/10 text-sky-100"}`}>{notice.type === "success" ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : notice.type === "error" ? <ShieldCheck className="mt-0.5 size-5 shrink-0" /> : <UploadCloud className="mt-0.5 size-5 shrink-0" />}<span>{notice.text}</span></div>}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(["media", "details", "publish"] as Step[]).map((item, index) => <button key={item} type="button" onClick={() => item !== "media" && file ? setStep(item) : undefined} className={`rounded-full border px-4 py-2 text-xs font-bold ${step === item ? "border-violet-300/50 bg-violet-500 text-white" : "border-white/10 bg-white/[.035] text-slate-500"}`}>{index + 1}. {item === "media" ? "Media" : item === "details" ? "Details" : "Publish"}</button>)}
      </div>

      {step === "publish" && notice?.type === "success" ? <section className="mx-auto max-w-2xl rounded-3xl border border-emerald-300/20 bg-emerald-500/[.06] p-8 text-center">
        <CheckCircle2 className="mx-auto size-14 text-emerald-300" />
        <h1 className="mt-5 text-2xl font-black text-white">Upload received</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-400">The media is stored in HkTube Storage, the video record is linked to your channel, and the published video is ready for viewers.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/studio" className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black">Open Creator Studio</Link><Link href="/clips" className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-white">Open Clips</Link><Link href="/" className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-white">Home</Link></div>
      </section> : <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {step === "media" ? <section className="rounded-3xl border border-white/10 bg-white/[.03] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">Step 1</p><h1 className="mt-1 text-2xl font-black text-white">Select your video</h1><p className="mt-2 text-sm leading-6 text-slate-400">HkTube switches portrait videos to Clip mode and landscape videos to Long Video mode.</p></div><FileVideo2 className="size-8 text-violet-300" /></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3"><button type="button" onClick={() => setUploadMode("video")} className={`rounded-2xl border p-4 text-left ${uploadMode === "video" ? "border-violet-300/50 bg-violet-500/10" : "border-white/10 bg-black/10"}`}><FileVideo2 className="size-5 text-violet-300" /><p className="mt-2 text-sm font-black text-white">YouTube-style Video</p><p className="mt-1 text-xs leading-5 text-slate-500">Landscape video with title, description, tags, category and custom thumbnail.</p></button><button type="button" onClick={() => setUploadMode("short")} className={`rounded-2xl border p-4 text-left ${uploadMode === "short" ? "border-pink-300/50 bg-pink-500/10" : "border-white/10 bg-black/10"}`}><Smartphone className="size-5 text-pink-300" /><p className="mt-2 text-sm font-black text-white">TikTok-style Clip</p><p className="mt-1 text-xs leading-5 text-slate-500">Vertical short-form video, up to 180 seconds.</p></button><button type="button" onClick={() => setUploadMode("auto")} className={`rounded-2xl border p-4 text-left ${uploadMode === "auto" ? "border-sky-300/50 bg-sky-500/10" : "border-white/10 bg-black/10"}`}><WandSparkles className="size-5 text-sky-300" /><p className="mt-2 text-sm font-black text-white">Smart Detect</p><p className="mt-1 text-xs leading-5 text-slate-500">Automatically chooses the format from the video.</p></button></div><div onDragOver={event => { event.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={onDrop} className={`mt-6 rounded-3xl border-2 border-dashed p-7 text-center transition ${dragActive ? "border-violet-300 bg-violet-500/10" : "border-white/12 bg-black/15"}`}>
              <input id="video-file" type="file" accept="video/mp4,video/webm" className="sr-only" onChange={event => void chooseVideo(event.target.files?.[0])} />
              <input id="video-camera" type="file" accept="video/mp4,video/webm" capture="environment" className="sr-only" onChange={event => void chooseVideo(event.target.files?.[0])} />
              <UploadCloud className="mx-auto size-12 text-violet-300" />
              <h2 className="mt-4 text-lg font-black text-white">{file ? file.name : "Drop a video here or choose from your device"}</h2>
              <p className="mt-2 text-xs text-slate-500">MP4/H.264 or WebM · up to 900 MB · resumable 6 MB chunks</p>
              <div className="mt-5 flex flex-wrap justify-center gap-3"><label htmlFor="video-file" className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-violet-500 px-5 text-sm font-bold text-white hover:bg-violet-400">Choose video</label><button type="button" onClick={() => void startRecording()} disabled={recording || uploading} className="inline-flex min-h-11 items-center rounded-full border border-white/12 px-5 text-sm font-bold text-white hover:bg-white/[.06]"><Circle className="mr-2 size-4 text-rose-300" />Record in HkTube</button><label htmlFor="video-camera" className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-white/12 px-5 text-sm font-bold text-white hover:bg-white/[.06]">Camera file</label></div>
            </div>
            {file && videoInfo && <div className="mt-5 grid gap-4 sm:grid-cols-[180px_1fr]"><div className="aspect-video overflow-hidden rounded-2xl bg-black">{videoPreview && <video src={videoPreview} muted controls playsInline className="size-full object-contain" />}</div><div className="rounded-2xl border border-white/10 bg-black/15 p-4"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-bold text-violet-200">{modeLabel}</span><span className="rounded-full bg-white/[.06] px-3 py-1 text-xs font-semibold text-slate-300">{videoInfo.width}×{videoInfo.height}</span><span className="rounded-full bg-white/[.06] px-3 py-1 text-xs font-semibold text-slate-300">{formatDuration(videoInfo.duration)}</span><span className="rounded-full bg-white/[.06] px-3 py-1 text-xs font-semibold text-slate-300">{formatBytes(file.size)}</span></div><p className="mt-3 text-xs leading-5 text-slate-500">The browser successfully read the video dimensions and duration before upload.</p><button type="button" onClick={() => { setFile(null); setVideoInfo(null); setThumbnail(null); }} className="mt-4 inline-flex items-center text-xs font-bold text-slate-400 hover:text-white"><X className="mr-1 size-3.5" />Replace video</button></div></div>}
            {file && <button type="button" onClick={() => setStep("details")} className="mt-5 inline-flex min-h-11 rounded-full bg-white px-6 text-sm font-bold text-black">Continue to details</button>}
          </section> : <section className="rounded-3xl border border-white/10 bg-white/[.03] p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">Step 2</p><h1 className="mt-1 text-2xl font-black text-white">Details & controls</h1></div><span className="rounded-full bg-violet-500/15 px-3 py-1.5 text-xs font-black text-violet-200">{modeLabel}</span></div>
            <div className="mt-6 space-y-5">
              <label className="block"><span className="text-sm font-bold text-white">Title <b className="text-rose-300">*</b></span><div className="mt-2 flex items-center gap-2"><input value={title} onChange={event => setTitle(event.target.value)} maxLength={100} required className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-300/50" placeholder={isShort ? "Write a strong Clip title" : "Give your video a clear title"} /><span className="text-[11px] text-slate-600">{title.length}/100</span></div><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => file && setTitle(titleFromFilename(file.name))} className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-300">Use filename as title</button><button type="button" onClick={() => setTags(suggestedTags(title || (file ? titleFromFilename(file.name) : ""), category))} className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-300">Auto-generate tags</button></div></label>
              <label className="block"><span className="text-sm font-bold text-white">Description</span><textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={5000} rows={7} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-300/50" placeholder="Explain what viewers will get from this video." /><span className="mt-1 block text-right text-[11px] text-slate-600">{description.length}/5000</span></label>
              <div className="grid gap-4 sm:grid-cols-2"><label><span className="text-sm font-bold text-white">Channel</span><select value={channelId} onChange={event => setChannelId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#151a25] px-4 py-3 text-sm text-white outline-none">{channels.map(channel => <option key={channel.id} value={channel.id}>{channel.displayName} (@{channel.handle})</option>)}</select></label><label><span className="text-sm font-bold text-white">Visibility</span><select value={visibility} onChange={event => setVisibility(event.target.value as typeof visibility)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#151a25] px-4 py-3 text-sm text-white outline-none"><option value="public">Public · publish now</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select></label><label><span className="text-sm font-bold text-white">Category</span><select value={category} onChange={event => setCategory(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#151a25] px-4 py-3 text-sm text-white outline-none"><option value="">Select category</option><option>Entertainment</option><option>Gaming</option><option>Music</option><option>Education</option><option>Technology</option><option>Sports</option><option>News</option><option>Comedy</option><option>How-to & Style</option><option>Travel</option><option>Science</option><option>People & Blogs</option><option>Film & Animation</option><option>Other</option></select></label><label><span className="text-sm font-bold text-white">Language</span><select value={language} onChange={event => setLanguage(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#151a25] px-4 py-3 text-sm text-white outline-none"><option>English</option><option>Urdu</option><option>Hindi</option><option>Arabic</option><option>Punjabi</option><option>Other</option></select></label></div>
              <label className="block"><span className="text-sm font-bold text-white">Tags</span><input value={tags} onChange={event => setTags(event.target.value)} maxLength={500} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" placeholder="gaming, tutorial, tech" /></label>
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="flex items-center gap-3"><ImagePlus className="size-5 text-violet-300" /><div className="min-w-0 flex-1"><p className="text-sm font-bold text-white">Thumbnail</p><p className="mt-0.5 text-xs text-slate-500">{autoThumbnail ? "Auto-generated from the video. Replace it if you want a custom frame." : "Use a custom thumbnail or keep the generated one."}</p></div><label className="cursor-pointer rounded-full border border-white/12 px-3 py-2 text-xs font-bold text-white">Change<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={event => chooseThumbnail(event.target.files?.[0])} /></label></div>{thumbnailPreview && <img src={thumbnailPreview} alt="Video thumbnail preview" className="mt-4 aspect-video w-full max-w-sm rounded-xl object-cover" />}</div>
              <div className="grid gap-3 sm:grid-cols-2"><Toggle checked={allowComments} onChange={setAllowComments} title="Allow comments" text="Let viewers comment on this video." /><Toggle checked={madeForKids} onChange={setMadeForKids} title="Made for kids" text="Mark this only when the content is specifically directed to children." /><Toggle checked={allowDownload} onChange={setAllowDownload} title="Allow downloads" text="Let eligible viewers save an original copy when supported." /><div className="rounded-2xl border border-sky-300/10 bg-sky-500/[.05] p-4"><p className="text-xs font-bold text-sky-200">Pre-upload checks</p><p className="mt-1 text-xs leading-5 text-slate-500">Format, size, dimensions and readable video track are checked locally. Copyright review is handled separately by platform moderation.</p></div></div>
            </div>
            {uploading ? <div className="mt-6 rounded-2xl border border-violet-300/20 bg-violet-500/10 p-5"><div className="flex items-center justify-between gap-4 text-sm font-bold text-white"><span>Uploading {modeLabel}…</span><span>{progress}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-violet-400 transition-[width] duration-300" style={{ width: `${progress}%` }} /></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400"><span>{file ? formatBytes(file.size) : ""}</span><span>{formatEta(eta)}</span></div><button type="button" onClick={cancelUpload} className="mt-4 inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white"><PauseCircle className="mr-2 size-4" />Pause upload</button></div> : <div className="mt-6 flex flex-wrap justify-between gap-3"><button type="button" onClick={() => setStep("media")} className="rounded-full border border-white/12 px-5 py-2.5 text-sm font-bold text-white">Back</button><button type="submit" disabled={!canSubmit} className="inline-flex min-h-12 items-center rounded-full bg-violet-500 px-6 text-sm font-black text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"><UploadCloud className="mr-2 size-4" />Upload {modeLabel}</button></div>}
          </section>}
        </div>
        <aside className="space-y-4">
          <section className="sticky top-20 rounded-3xl border border-white/10 bg-white/[.03] p-5">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">Live preview</p>
            <div className={`mt-4 overflow-hidden rounded-2xl bg-black ${isShort ? "aspect-[9/16] max-h-[520px]" : "aspect-video"}`}>{videoPreview ? <video src={videoPreview} poster={thumbnailPreview || undefined} controls muted playsInline className="size-full object-contain" /> : <div className="grid size-full min-h-44 place-items-center text-center text-xs text-slate-600"><PlayCircle className="mb-2 size-8" />Your video preview appears here</div>}</div>
            <div className="mt-4"><p className="line-clamp-2 text-sm font-black text-white">{title || "Your video title"}</p><p className="mt-1 text-xs text-slate-500">{selectedChannel ? `@${selectedChannel.handle}` : "@yourchannel"} · {videoInfo ? formatDuration(videoInfo.duration) : "0:00"}</p></div>
          </section>
          <section className="rounded-3xl border border-white/10 bg-white/[.03] p-5"><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-300" /><p className="text-sm font-bold text-white">Upload reliability</p></div><ul className="mt-3 space-y-2 text-xs leading-5 text-slate-500"><li>• Large files use resumable 6 MB chunks.</li><li>• Interrupted chunks retry automatically.</li><li>• The same file can continue from a saved transfer.</li><li>• Media is linked to your selected channel.</li><li>• Public videos are published after the upload transaction succeeds.</li></ul></section>
        </aside>
      </form>}
    </main>
  </HkTubeShell>;
}

function Toggle({ checked, onChange, title, text }: { checked: boolean; onChange: (value: boolean) => void; title: string; text: string }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/10 p-4"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="mt-1 size-4 accent-violet-500" /><span><b className="block text-sm text-white">{title}</b><span className="mt-1 block text-xs leading-5 text-slate-500">{text}</span></span></label>;
}
