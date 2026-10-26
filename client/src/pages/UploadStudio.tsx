import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileVideo2,
  ImagePlus,
  Loader2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Video,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { HkTubeShell } from "@/components/HkTubeShell";
import {
  HkTubeCreatorGallery,
  type CreatorGalleryMode,
} from "@/components/HkTubeCreatorGallery";
import { MediaEditor } from "@/components/MediaEditor";
import { ShortCameraStudio } from "@/components/ShortCameraStudio";
import { ClipsBrandIcon } from "@/components/ClipsBrandIcon";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import {
  listMySupabaseChannels,
  type SupabaseChannel,
} from "@/lib/supabaseChannels";
import { createSupabaseVideo } from "@/lib/supabaseVideos";
import {
  setPendingCreateMedia,
  takePendingCreateMedia,
} from "@/lib/pendingCreateMedia";

type StudioMode = "video" | "clip";
type VideoInfo = { width: number; height: number; duration: number };
const MAX_VIDEO_BYTES = 900 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 12 * 1024 * 1024;
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const THUMBNAIL_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const CATEGORIES = [
  "Entertainment",
  "Gaming",
  "Education",
  "Music",
  "Sports",
  "News",
  "Technology",
  "Lifestyle",
  "Comedy",
  "Travel",
  "Other",
];

function fileTitle(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}
function suggestedTags(filename: string) {
  return Array.from(
    new Set(
      fileTitle(filename)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(word => word.length >= 3)
    )
  ).slice(0, 10);
}
function inferCategory(text: string) {
  const value = text.toLowerCase();
  if (
    /game|gaming|minecraft|roblox|pubg|free fire|fortnite|playstation|xbox/.test(
      value
    )
  )
    return "Gaming";
  if (/learn|tutorial|how to|lesson|study|science|math|education/.test(value))
    return "Education";
  if (/song|music|cover|sing|dance|beat|remix/.test(value)) return "Music";
  if (/football|cricket|basketball|match|sports|goal|fitness/.test(value))
    return "Sports";
  if (/news|update|breaking|politics|weather/.test(value)) return "News";
  if (/tech|phone|android|iphone|ai tools|software|review|app/.test(value))
    return "Technology";
  if (/travel|trip|vlog|food|recipe|daily life/.test(value)) return "Lifestyle";
  if (/funny|comedy|prank|meme|reaction/.test(value)) return "Comedy";
  return "Entertainment";
}
function buildDescription(titleValue: string) {
  const clean = titleValue.trim();
  return clean
    ? `${clean}\n\nWatch, enjoy and share more on HkTube. Subscribe for more videos and leave your thoughts in the comments.`
    : "";
}
function qualityLabel(info: VideoInfo | null) {
  if (!info) return "Waiting for video";
  if (info.height >= 4320 || info.width >= 7680) return "8K source";
  if (info.height >= 2160 || info.width >= 3840) return "4K source";
  if (info.height >= 1440 || info.width >= 2560) return "1440p source";
  if (info.height >= 1080 || info.width >= 1920) return "Full HD source";
  if (info.height >= 720 || info.width >= 1280) return "HD source";
  return "Standard source";
}
function bytesLabel(bytes: number) {
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
function durationLabel(seconds: number) {
  const value = Math.floor(seconds || 0);
  return Math.floor(value / 60) + ":" + String(value % 60).padStart(2, "0");
}
async function readVideoInfo(file: File): Promise<VideoInfo> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  try {
    const info = await new Promise<VideoInfo>((resolve, reject) => {
      const timeout = window.setTimeout(
        () =>
          reject(
            new Error(
              "Video metadata took too long to load. Try a standard MP4/H.264 or WebM file."
            )
          ),
        12000
      );
      video.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        if (!video.videoWidth || !video.videoHeight)
          return reject(
            new Error("This file does not contain readable video.")
          );
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: Number.isFinite(video.duration) ? video.duration : 0,
        });
      };
      video.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("This video cannot be decoded by your browser."));
      };
      video.src = url;
    });
    return info;
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
async function extractVideoFrames(file: File, count = 4): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Video analysis timed out while reading the file.")), 12000);
      video.onloadedmetadata = () => { window.clearTimeout(timeout); resolve(); };
      video.onerror = () => { window.clearTimeout(timeout); reject(new Error("Browser could not read this video for AI analysis.")); };
      video.src = url;
    });
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (!duration || video.videoWidth < 1 || video.videoHeight < 1) throw new Error("This video has no readable frames.");
    const frames: string[] = [];
    for (let index = 0; index < count; index++) {
      const timestamp = Math.min(Math.max(duration * ((index + 1) / (count + 1)), 0.05), Math.max(duration - 0.05, 0.05));
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("Video frame extraction timed out.")), 8000);
        const done = (error?: Error) => { window.clearTimeout(timeout); error ? reject(error) : resolve(); };
        video.onseeked = () => done();
        video.onerror = () => done(new Error("Could not extract a video frame."));
        try { video.currentTime = timestamp; } catch { done(new Error("Could not seek within this video.")); }
      });
      const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Video frame processing is not supported by this browser.");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.68));
    }
    return frames;
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

async function thumbnailAt(file: File, fraction = 0.12): Promise<File | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  try {
    return await new Promise<File | null>(resolve => {
      let finished = false;
      const done = (fileValue: File | null) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        resolve(fileValue);
      };
      const timeout = window.setTimeout(() => done(null), 10000);
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(
          Math.max(video.duration * fraction, 0.1),
          Math.max(video.duration - 0.1, 0.1)
        );
      };
      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(
          1,
          1280 / Math.max(video.videoWidth, video.videoHeight)
        );
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) return done(null);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          blob =>
            done(
              blob
                ? new File([blob], "hktube-cover.jpg", { type: "image/jpeg" })
                : null
            ),
          "image/jpeg",
          0.9
        );
      };
      video.onerror = () => done(null);
      video.src = url;
    });
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

export default function UploadStudioPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [stage, setStage] = useState<"select" | "edit" | "details">("select");
  const [creatorGalleryOpen, setCreatorGalleryOpen] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<StudioMode>(() => {
    const params = new URLSearchParams(window.location.search);
    return window.location.pathname === "/clips/create" ||
      params.get("category") === "shorts" ||
      params.get("mode") === "clip"
      ? "clip"
      : "video";
  });
  const [channels, setChannels] = useState<SupabaseChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelId, setChannelId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailSource, setThumbnailSource] = useState<
    "automatic" | "custom"
  >("automatic");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionEdited, setDescriptionEdited] = useState(false);
  const [category, setCategory] = useState("Entertainment");
  const [language, setLanguage] = useState("English");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<
    "public" | "unlisted" | "private"
  >("public");
  const [comments, setComments] = useState(true);
  const [downloads, setDownloads] = useState(false);
  const [madeForKids, setMadeForKids] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [draggingFile, setDraggingFile] = useState(false);
  const [error, setError] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [generatingMetadata, setGeneratingMetadata] = useState(false);
  const generateVideoMetadata = trpc.creator_studio.generateVideoMetadata.useMutation();
  const abortRef = useRef<AbortController | null>(null);
  const videoUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : ""),
    [file]
  );
  const thumbnailUrl = useMemo(
    () => (thumbnail ? URL.createObjectURL(thumbnail) : ""),
    [thumbnail]
  );

  useEffect(
    () => () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    },
    [videoUrl]
  );
  useEffect(
    () => () => {
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    },
    [thumbnailUrl]
  );
  useEffect(() => {
    const handler = (event: Event) => {
      const mode = (event as CustomEvent<unknown>).detail;
      if (mode !== "video" && mode !== "clip") return;
      setMode(mode);
      setFile(null);
      setInfo(null);
      setThumbnail(null);
      setThumbnailSource("automatic");
      setError("");
      setResultMessage("");

      setStage("select");
    };
    window.addEventListener("hktube-upload-mode", handler);
    return () => window.removeEventListener("hktube-upload-mode", handler);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      if (!authLoading) startLogin();
      return;
    }
    let active = true;
    setChannelsLoading(true);
    void listMySupabaseChannels()
      .then(values => {
        if (!active) return;
        setChannels(values);
        setChannelId(current =>
          current && values.some(item => item.id === current)
            ? current
            : (values[0]?.id ?? "")
        );
        if (!values.length)
          setError("Create your HkTube channel before uploading.");
      })
      .catch(cause => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Your channel list could not load."
          );
      })
      .finally(() => {
        if (active) setChannelsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, authLoading]);

  async function selectVideo(
    next: File | undefined,
    modeOverride?: StudioMode
  ) {
    if (!next || busy) return;
    const selectedMode = modeOverride ?? mode;
    if (modeOverride) setMode(modeOverride);
    setError("");
    setResultMessage("");
    const type = next.type.toLowerCase().split(";", 1)[0];
    if (!VIDEO_TYPES.has(type)) {
      setError("Choose an MP4/H.264 or WebM video.");
      return;
    }
    if (next.size <= 0 || next.size > MAX_VIDEO_BYTES) {
      setError("Video must be between 1 byte and 900 MB.");
      return;
    }
    try {
      const nextInfo = await readVideoInfo(next);
      if (selectedMode === "clip" && nextInfo.width > nextInfo.height)
        throw new Error("Clips require a vertical portrait video.");
      if (selectedMode === "clip" && nextInfo.duration > 180)
        throw new Error("Clips cannot exceed 180 seconds.");
      if (
        selectedMode === "video" &&
        nextInfo.width / Math.max(nextInfo.height, 1) < 1.25
      )
        throw new Error("Long Video mode requires a landscape video.");
      setFile(next);
      setInfo(nextInfo);
      const suggestedTitle = fileTitle(next.name);
      if (!title.trim()) setTitle(suggestedTitle);
      if (!tags.trim()) setTags(suggestedTags(suggestedTitle).join(", "));
      if (!description.trim() && !descriptionEdited)
        setDescription(buildDescription(suggestedTitle));
      if (!title.trim()) setCategory(inferCategory(suggestedTitle));
      setThumbnailSource("automatic");
      setThumbnail(await thumbnailAt(next));

      setStage("edit");
      setResultMessage("");
    } catch (cause) {
      setFile(null);
      setInfo(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "The selected video could not be read."
      );
    }
  }

  useEffect(() => {
    const pending = takePendingCreateMedia();
    if (!pending || pending.mode === "post") return;
    const expectedMode: StudioMode = pending.mode === "clip" ? "clip" : "video";
    void selectVideo(pending.file, expectedMode);
  }, []);

  async function generateMetadataFromVideo() {
    if (!file || !info || generatingMetadata || busy) return;
    setGeneratingMetadata(true);
    setError("");
    try {
      const frames = await extractVideoFrames(file, 4);
      const result = await generateVideoMetadata.mutateAsync({
        frames,
        mode,
        durationSeconds: Math.floor(info.duration),
        width: info.width,
        height: info.height,
        category,
        filename: file.name.slice(0, 160),
      });
      setTitle(result.title.slice(0, 100));
      setDescription(result.description.slice(0, 5000));
      setDescriptionEdited(true);
      setTags(result.tags.slice(0, 30).join(", ").slice(0, 1000));
      if (CATEGORIES.includes(result.category)) setCategory(result.category);
      toast.success("AI ne video frames se title, description aur tags generate kar diye. Publish se pehle review kar lo.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "AI metadata generate nahi ho saka.";
      setError(message);
      toast.error(message);
    } finally {
      setGeneratingMetadata(false);
    }
  }

  async function applyEditedVideo(next: File) {
    try {
      const nextInfo = await readVideoInfo(next);
      setFile(next);
      setInfo(nextInfo);
      setThumbnail(await thumbnailAt(next));
      setThumbnailSource("automatic");
      setStage("details");
      setError("");
      toast.success("Edits applied. Review details before publishing.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not read the edited video."
      );
    }
  }

  function switchMode(next: StudioMode) {
    if (busy || mode === next) return;
    setMode(next);
    setFile(null);
    setInfo(null);
    setThumbnail(null);
    setThumbnailSource("automatic");
    setError("");
    setResultMessage("");
    setStage("select");
  }

  function openUploadGallery() {
    setCreatorGalleryOpen(true);
  }

  function selectThumbnail(event: ChangeEvent<HTMLInputElement>) {
    const next = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!next) return;
    if (!THUMBNAIL_TYPES.has(next.type.toLowerCase())) {
      setError("Thumbnail must be JPG, PNG, WebP or AVIF.");
      return;
    }
    if (next.size > MAX_THUMBNAIL_BYTES) {
      setError("Thumbnail must be 12 MB or smaller.");
      return;
    }
    setThumbnail(next);
    setThumbnailSource("custom");
    setError("");
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !info || !channelId || busy) return;
    if (!title.trim()) {
      setError("Video title is required.");
      return;
    }
    if (mode === "clip" && info.duration > 180) {
      setError("Clips cannot exceed 180 seconds.");
      return;
    }
    setBusy(true);
    setProgress(0);
    setError("");
    setResultMessage("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const record = await createSupabaseVideo({
        channelId,
        title: title.trim(),
        description: description.trim(),
        file,
        thumbnail,
        isShort: mode === "clip",
        durationSeconds: Math.floor(info.duration),
        category: category || null,
        language: language.trim() || null,
        visibility,
        allowComments: comments,
        allowDownload: downloads,
        madeForKids,
        tags: tags
          .split(/[,\n#]+/)
          .map(value => value.trim())
          .filter(Boolean)
          .slice(0, 30),
        signal: controller.signal,
        onProgress: setProgress,
      });
      const waitingForChecks =
        record.status === "processing" || record.moderationStatus === "pending";
      const message = waitingForChecks
        ? "Upload received. Media processing and safety review are pending; HkTube will apply visibility after those checks."
        : "Upload saved successfully.";
      setResultMessage(message);
      toast.success(
        waitingForChecks
          ? "Upload received; processing is pending."
          : "Upload saved."
      );
      setFile(null);
      setInfo(null);
      setThumbnail(null);
      setTitle("");
      setDescription("");
      setDescriptionEdited(false);
      setTags("");
      setStage("select");
      if (!waitingForChecks) navigate("/studio");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Upload failed. Try again.";
      if (cause instanceof DOMException && cause.name === "AbortError")
        setError(
          "Upload paused. Select the same file again to resume the transfer."
        );
      else setError(message);
      toast.error(message);
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  return (
    <div className="hktube-upload-reference">
      <HkTubeShell
        title={mode === "clip" ? "Create a Clip" : "Upload a video"}
        subtitle="Upload and publish your video with the same clear creator flow."
      >
        <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-5 sm:px-7 lg:px-10">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-white/[.06]"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/[.06] px-3 py-2 text-xs font-bold text-emerald-200">
              <ShieldCheck className="size-4" />
              Secure upload · account ownership
            </div>
          </div>

          <section
            className={`hktube-upload-card hktube-upload-stage-${stage} overflow-hidden rounded-[28px] border border-white/10 bg-[#101321] shadow-2xl shadow-black/20`}
          >
            <header className="border-b border-white/10 bg-gradient-to-r from-violet-500/15 via-transparent to-cyan-400/[.08] p-4 sm:p-6">
              <p className="text-[11px] font-black uppercase tracking-[.22em] text-cyan-300">
                STEP{" "}
                {stage === "select"
                  ? "1 OF 3 · CAPTURE"
                  : stage === "edit"
                    ? "2 OF 3 · EDIT"
                    : "3 OF 3 · DETAILS & PUBLISH"}
              </p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                {mode === "clip" ? "Create a Clip" : "Upload a video"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                {mode === "clip"
                  ? "Choose a vertical video, edit it, add sound and publish it as a Clip."
                  : "Choose a video from your gallery, set its cover and add publishing details."}
              </p>
              <div
                className="mt-5 grid grid-cols-3 gap-2"
                aria-label="Upload steps"
              >
                {(
                  [
                    {
                      key: "select",
                      label: "1. Capture",
                      done: stage !== "select",
                    },
                    {
                      key: "edit",
                      label: "2. Edit",
                      done: stage === "details",
                    },
                    { key: "details", label: "3. Publish", done: false },
                  ] as const
                ).map(item => (
                  <div
                    key={item.key}
                    className={
                      "rounded-xl border px-3 py-2.5 text-center text-xs font-bold " +
                      (stage === item.key
                        ? "border-violet-300/40 bg-violet-500/15 text-white"
                        : item.done
                          ? "border-emerald-300/20 bg-emerald-500/[.06] text-emerald-200"
                          : "border-white/10 bg-black/10 text-slate-500")
                    }
                  >
                    {item.label}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => switchMode("video")}
                  aria-pressed={mode === "video"}
                  className={
                    "inline-flex min-h-12 items-center gap-2.5 rounded-full border px-5 text-sm font-black transition " +
                    (mode === "video"
                      ? "border-violet-300/50 bg-violet-500/15 text-white"
                      : "border-white/10 bg-black/15 text-slate-400 hover:text-white")
                  }
                >
                  <FileVideo2 className="size-5" strokeWidth={2.25} />
                  Long Video
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("clip")}
                  aria-pressed={mode === "clip"}
                  className={
                    "inline-flex min-h-12 items-center gap-2.5 rounded-full border px-5 text-sm font-black transition " +
                    (mode === "clip"
                      ? "border-fuchsia-300/50 bg-fuchsia-500/10 text-white"
                      : "border-white/10 bg-black/15 text-slate-400 hover:text-white")
                  }
                >
                  <ClipsBrandIcon className="size-9" />
                  Clips
                </button>
              </div>
            </header>

            <form
              onSubmit={event => void publish(event)}
              className={
                "grid gap-6 p-4 sm:p-6 " +
                (stage === "details"
                  ? "lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,.75fr)]"
                  : "grid-cols-1")
              }
            >
              <div className="min-w-0 space-y-5">
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="video/mp4,video/webm"
                  className="sr-only"
                  disabled={busy}
                  onChange={event => {
                    void selectVideo(event.currentTarget.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
                {stage === "select" && (
                  <ShortCameraStudio
                    isShort={mode === "clip"}
                    disabled={busy || channelsLoading || !isAuthenticated}
                    onSelectFile={next => {
                      void selectVideo(next);
                    }}
                    onChooseGallery={openUploadGallery}
                  />
                )}

                {stage === "edit" && file && info && (
                  <div className="fixed inset-0 z-[100] h-[100dvh] overflow-y-auto overscroll-contain bg-[#070910] px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(.75rem,env(safe-area-inset-top))] text-white sm:px-6">
                    <div className="mx-auto flex min-h-full w-full max-w-none flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-white">
                          Edit your video
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {file.name} · {info.width} × {info.height} ·{" "}
                          {durationLabel(info.duration)}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setStage("select")}
                        className="rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/[.05]"
                      >
                        Replace video
                      </button>
                    </div>
                    <MediaEditor
                      file={file}
                      isShort={mode === "clip"}
                      onApply={edited => {
                        void applyEditedVideo(edited);
                      }}
                    />
                    <div className="flex flex-wrap justify-end gap-2 rounded-2xl border border-white/10 bg-black/15 p-4">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setStage("details")}
                        className="min-h-11 rounded-full border border-white/15 px-5 text-sm font-bold text-slate-300 hover:bg-white/[.05]"
                      >
                        Skip editing
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setStage("details")}
                        className="min-h-11 rounded-full bg-violet-600 px-5 text-sm font-black text-white hover:bg-violet-500"
                      >
                        Continue to details <span aria-hidden="true">→</span>
                      </button>
                    </div>
                    </div>
                  </div>
                )}

                {stage === "details" && (
                  <section className="hktube-upload-card rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5">
                    <h2 className="font-black text-white">Add details</h2>
                    <div className="mt-4 space-y-4">
                      <div className="rounded-2xl border border-violet-300/20 bg-gradient-to-r from-violet-500/10 to-cyan-500/[.06] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 text-sm font-black text-white"><Sparkles className="size-4 text-violet-300" /> AI Video Metadata</p>
                            <p className="mt-1 text-xs leading-5 text-slate-400">AI selected video ke 4 frames analyze karke title, description, tags aur category suggest karega.</p>
                          </div>
                          <button type="button" onClick={() => void generateMetadataFromVideo()} disabled={!file || generatingMetadata || busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-xs font-black text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">
                            {generatingMetadata ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                            {generatingMetadata ? "Video analyze ho rahi hai..." : "Generate with AI"}
                          </button>
                        </div>
                        <p className="mt-2 text-[11px] leading-5 text-slate-500">AI output ko publish se pehle review karo. Yeh sampled visual frames par based hai, full audio transcription nahi.</p>
                      </div>
                      <label className="block">
                        <span className="flex items-center justify-between gap-3 text-sm font-bold text-white">
                          <span>Title *</span>
                          <span className="text-xs text-slate-500">
                            {title.length}/100
                          </span>
                        </span>
                        <input
                          value={title}
                          onChange={event => {
                            const value = event.target.value.slice(0, 100);
                            setTitle(value);
                            setTags(suggestedTags(value).join(", "));
                            setCategory(inferCategory(value));
                            if (!descriptionEdited)
                              setDescription(buildDescription(value));
                          }}
                          maxLength={100}
                          required
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-300/50"
                          placeholder={
                            mode === "clip"
                              ? "Caption your Clip"
                              : "Create a title (type @ to mention a channel)"
                          }
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-bold text-white">
                          Description / caption
                        </span>
                        <textarea
                          value={description}
                          onChange={event => {
                            setDescription(event.target.value.slice(0, 5000));
                            setDescriptionEdited(true);
                          }}
                          maxLength={5000}
                          rows={4}
                          className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none focus:border-violet-300/50"
                          placeholder="Tell viewers what this video is about…"
                        />
                      </label>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                          <span className="text-sm font-bold text-white">
                            Category
                          </span>
                          <select
                            value={category}
                            onChange={event => setCategory(event.target.value)}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-[#151a25] px-3 py-3 text-sm text-white"
                          >
                            {CATEGORIES.map(item => (
                              <option key={item}>{item}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-sm font-bold text-white">
                            Language
                          </span>
                          <input
                            value={language}
                            onChange={event =>
                              setLanguage(event.target.value.slice(0, 32))
                            }
                            maxLength={32}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white"
                            placeholder="English"
                          />
                        </label>
                      </div>
                      <label className="block">
                        <span className="text-sm font-bold text-white">
                          Tags / hashtags
                        </span>
                        <input
                          value={tags}
                          onChange={event =>
                            setTags(event.target.value.slice(0, 1000))
                          }
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"
                          placeholder="#gaming, tutorial, funny"
                        />
                        <span className="mt-1 block text-xs text-slate-500">
                          Tags update from your title as a starting point.
                          Review them for accuracy before publishing.
                        </span>
                      </label>
                      <div className="rounded-2xl border border-violet-300/15 bg-violet-500/[.06] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-wider text-violet-200">
                              Smart creator assist
                            </p>
                            <p className="mt-1 text-sm font-bold text-white">
                              Suggested category:{" "}
                              {inferCategory(title || file?.name || "")}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-400">
                              Local keyword suggestions, not live trend
                              analytics. Check tags against the actual video
                              topic.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const seed =
                                title.trim() ||
                                (file ? fileTitle(file.name) : "");
                              setTags(suggestedTags(seed).join(", "));
                              setCategory(inferCategory(seed));
                              if (!descriptionEdited)
                                setDescription(buildDescription(seed));
                              toast.success(
                                "Metadata suggestions updated. Review them before publishing."
                              );
                            }}
                            className="rounded-full border border-violet-300/25 px-3 py-2 text-xs font-black text-violet-100 hover:bg-violet-300/10"
                          >
                            Refresh suggestions
                          </button>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          <div className="rounded-xl bg-black/20 p-3">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">
                              Source quality
                            </p>
                            <p className="mt-1 text-sm font-black text-white">
                              {qualityLabel(info)}
                            </p>
                          </div>
                          <div className="rounded-xl bg-black/20 p-3">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">
                              Resolution
                            </p>
                            <p className="mt-1 text-sm font-black text-white">
                              {info
                                ? `${info.width} × ${info.height}`
                                : "Not detected"}
                            </p>
                          </div>
                          <div className="col-span-2 rounded-xl bg-black/20 p-3 sm:col-span-1">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">
                              Metadata check
                            </p>
                            <p className="mt-1 text-sm font-black text-white">
                              {title.trim().length >= 20 &&
                              description.trim().length >= 40 &&
                              tags.trim()
                                ? "Ready to review"
                                : "Add useful details"}
                            </p>
                          </div>
                        </div>
                        <p className="mt-3 text-[11px] leading-5 text-slate-500">
                          HkTube reports the file’s detected source resolution.
                          It does not upscale or convert a file to 4K/8K during
                          this step.
                        </p>
                      </div>
                    </div>
                  </section>
                )}
              </div>

              <aside
                className={
                  "min-w-0 space-y-5 " + (stage !== "details" ? "hidden" : "")
                }
              >
                <section className="hktube-upload-card rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5">
                  <h2 className="font-black text-white">Cover</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    A frame is generated from your video. You can replace it
                    with your own image.
                  </p>
                  <div className="mt-4 flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-black/40">
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt="Video thumbnail preview"
                        className="size-full object-contain"
                      />
                    ) : (
                      <ImagePlus className="size-10 text-slate-600" />
                    )}
                  </div>
                  <label className="mt-4 flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-white/10 px-4 text-xs font-black text-white hover:bg-white/[.05]">
                    Edit thumbnail / choose from gallery
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      className="sr-only"
                      disabled={busy}
                      onChange={selectThumbnail}
                    />
                  </label>
                  {thumbnailSource === "custom" && (
                    <button
                      type="button"
                      onClick={() => {
                        if (file)
                          void thumbnailAt(file).then(value => {
                            setThumbnail(value);
                            setThumbnailSource("automatic");
                          });
                      }}
                      className="mt-2 text-xs font-bold text-violet-200 underline"
                    >
                      Regenerate automatic cover
                    </button>
                  )}
                </section>

                <section className="hktube-upload-card rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5">
                  <h2 className="font-black text-white">Publishing settings</h2>
                  <label className="mt-4 block">
                    <span className="text-sm font-bold text-white">
                      Your channel
                    </span>
                    <select
                      value={channelId}
                      onChange={event => setChannelId(event.target.value)}
                      disabled={channelsLoading || busy || !channels.length}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-[#151a25] px-3 py-3 text-sm text-white"
                    >
                      <option value="">
                        {channelsLoading
                          ? "Loading channels…"
                          : "Select your channel"}
                      </option>
                      {channels.map(channel => (
                        <option key={channel.id} value={channel.id}>
                          @{channel.handle} · {channel.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="mt-4 block">
                    <span className="text-sm font-bold text-white">
                      Visibility
                    </span>
                    <select
                      value={visibility}
                      onChange={event =>
                        setVisibility(event.target.value as typeof visibility)
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-[#151a25] px-3 py-3 text-sm text-white"
                    >
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  </label>
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={comments}
                        onChange={event => setComments(event.target.checked)}
                        className="size-4 accent-violet-500"
                      />
                      Allow comments
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={downloads}
                        onChange={event => setDownloads(event.target.checked)}
                        className="size-4 accent-violet-500"
                      />
                      Allow downloads (if enabled for this content)
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={madeForKids}
                        onChange={event => setMadeForKids(event.target.checked)}
                        className="size-4 accent-violet-500"
                      />
                      Yes, it's made for kids
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen(value => !value)}
                    className="mt-4 text-xs font-bold text-violet-200 underline"
                  >
                    {advancedOpen
                      ? "Hide advanced details"
                      : "Show advanced details"}
                  </button>
                  {advancedOpen && (
                    <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-white/[.025] p-4">
                      <p className="text-sm font-bold text-white">
                        Current publishing choices
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-black/20 p-3">
                          <span className="block text-slate-500">Audience</span>
                          <span className="mt-1 block font-bold text-slate-100">
                            {madeForKids
                              ? "Made for kids"
                              : "Not marked for kids"}
                          </span>
                        </div>
                        <div className="rounded-lg bg-black/20 p-3">
                          <span className="block text-slate-500">
                            Visibility
                          </span>
                          <span className="mt-1 block font-bold capitalize text-slate-100">
                            {visibility}
                          </span>
                        </div>
                        <div className="rounded-lg bg-black/20 p-3">
                          <span className="block text-slate-500">Comments</span>
                          <span className="mt-1 block font-bold text-slate-100">
                            {comments ? "Allowed" : "Disabled"}
                          </span>
                        </div>
                        <div className="rounded-lg bg-black/20 p-3">
                          <span className="block text-slate-500">
                            Downloads
                          </span>
                          <span className="mt-1 block font-bold text-slate-100">
                            {downloads ? "Requested on" : "Off"}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs leading-5 text-slate-400">
                        Playlist assignment, location, paid-promotion
                        disclosure, remix permissions and AI disclosure are not
                        currently supported by the saved video schema. They are
                        not shown as completed or silently applied.
                      </p>
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-emerald-300/10 bg-emerald-500/[.035] p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-300" />
                    <div>
                      <p className="text-sm font-black text-white">
                        Protected publishing
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        Uploads use the signed-in user and existing resumable
                        transfer. The video is not shown as live until media
                        processing and safety checks finish.
                      </p>
                    </div>
                  </div>
                </section>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-rose-300/20 bg-rose-500/10 p-3 text-sm leading-5 text-rose-100"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    {error}
                  </div>
                )}
                {resultMessage && (
                  <div
                    role="status"
                    className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm leading-5 text-emerald-100"
                  >
                    {resultMessage}
                  </div>
                )}

                {busy && (
                  <div className="rounded-xl border border-violet-300/15 bg-violet-500/[.06] p-4">
                    <div className="flex items-center justify-between gap-3 text-xs font-bold text-white">
                      <span>Uploading and saving</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/40">
                      <div
                        className="h-full rounded-full bg-violet-400 transition-all"
                        style={{ width: progress + "%" }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => abortRef.current?.abort()}
                      className="mt-3 text-xs font-bold text-rose-200 underline"
                    >
                      Cancel upload
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    stage !== "details" ||
                    busy ||
                    !file ||
                    !info ||
                    !title.trim() ||
                    !channelId ||
                    channelsLoading
                  }
                  className="hktube-sticky-upload inline-flex min-h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 text-sm font-black text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Uploading {progress}%…
                    </>
                  ) : (
                    <>
                      <UploadCloud className="mr-2 size-4" />
                      {mode === "clip" ? "Publish Clip" : "Upload"}
                    </>
                  )}
                </button>
                {!channelsLoading && !channels.length && (
                  <button
                    type="button"
                    onClick={() => navigate("/channel/create")}
                    className="w-full rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-slate-200 hover:bg-white/[.04]"
                  >
                    Create HkTube channel first
                  </button>
                )}
              </aside>
            </form>
          </section>
        </main>
      </HkTubeShell>
      {creatorGalleryOpen && (
            <HkTubeCreatorGallery
              initialMode={mode === "clip" ? "clip" : "video"}
              onClose={() => setCreatorGalleryOpen(false)}
              onContinue={(
                selectedMode: CreatorGalleryMode,
                selectedFile: File
              ) => {
                setCreatorGalleryOpen(false);
                if (selectedMode === "post") {
                  setPendingCreateMedia("post", selectedFile);
                  navigate("/upload/post");
                } else {
                  void selectVideo(selectedFile, selectedMode);
                }
              }}
            />
      )}
    </div>
  );
}
