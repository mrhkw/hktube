import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  Circle,
  FileVideo2,
  FlipHorizontal2,
  ImagePlus,
  Loader2,
  PauseCircle,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Square,
  UploadCloud,
  Video,
  WandSparkles,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  listMySupabaseChannels,
  type SupabaseChannel,
} from "@/lib/supabaseChannels";
import { createSupabaseVideo } from "@/lib/supabaseVideos";
import { startLogin } from "@/const";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

type Notice = { type: "success" | "error" | "info"; text: string } | null;
type Step = "media" | "details";
type UploadMode = "video" | "clip" | "auto";
type VideoInfo = { width: number; height: number; duration: number };
type CameraFacing = "user" | "environment";

const MAX_VIDEO_BYTES = 900 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 12 * 1024 * 1024;
const ACCEPTED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const ACCEPTED_THUMBNAIL_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const DRAFT_KEY = "hktube-upload-draft-v3";

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}

function formatEta(seconds: number | null) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0)
    return "calculating…";
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s left`;
}

function titleFromFilename(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function suggestedTags(title: string, category: string) {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length >= 3);
  return Array.from(
    new Set([category.trim().toLowerCase(), ...words].filter(Boolean))
  )
    .slice(0, 10)
    .join(", ");
}

function friendlyUploadError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (/row-level security|policy|not authorized|permission denied/i.test(raw)) {
    return "Upload permission denied. Sign in again and make sure you own the selected channel.";
  }
  if (/bucket|storage object|object not found/i.test(raw)) {
    return "Video storage is not available right now. Retry in a moment.";
  }
  if (/network|fetch|failed to fetch|timeout|abort|interrupted/i.test(raw)) {
    return "The connection interrupted the upload. HkTube uses resumable chunks, so the transfer can be continued.";
  }
  if (/duplicate|already exists/i.test(raw)) {
    return "This upload already exists. Choose the file again to create a fresh upload.";
  }
  return raw || "Upload failed. Check the file and try again.";
}

async function inspectVideo(file: File): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    let finished = false;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    const finishError = (message: string) => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error(message));
    };

    const timeout = window.setTimeout(
      () =>
        finishError(
          "HkTube could not read this video. Export a standard MP4/H.264 or WebM file."
        ),
      12000
    );

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (finished) return;
      window.clearTimeout(timeout);
      if (!video.videoWidth || !video.videoHeight) {
        finishError("This file does not contain a readable video track.");
        return;
      }
      finished = true;
      const duration = Number.isFinite(video.duration)
        ? Math.max(0, video.duration)
        : 0;
      const info = {
        width: video.videoWidth,
        height: video.videoHeight,
        duration,
      };
      cleanup();
      resolve(info);
    };
    video.onerror = () => {
      window.clearTimeout(timeout);
      finishError(
        "HkTube could not decode this video. Use a standard MP4/H.264 or WebM export."
      );
    };
    video.src = url;
  });
}

async function generateThumbnailAt(
  file: File,
  info: VideoInfo,
  position: number
): Promise<File | null> {
  return new Promise(resolve => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const canvas = document.createElement("canvas");
    let settled = false;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    const finish = (value: File | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      cleanup();
      resolve(value);
    };

    const timeout = window.setTimeout(() => finish(null), 10000);
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      const target = Math.min(
        Math.max(info.duration * position, 0.1),
        Math.max(info.duration - 0.1, 0.1)
      );
      video.currentTime = target;
    };

    video.onseeked = () => {
      canvas.width = Math.min(info.width, 1280);
      canvas.height = Math.max(
        1,
        Math.round((canvas.width * info.height) / info.width)
      );
      const ctx = canvas.getContext("2d");
      if (!ctx) return finish(null);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        blob => {
          if (!blob) return finish(null);
          finish(
            new File(
              [blob],
              `${file.name.replace(/\.[^.]+$/, "")}-thumbnail.jpg`,
              { type: "image/jpeg" }
            )
          );
        },
        "image/jpeg",
        0.84
      );
    };

    video.onerror = () => finish(null);
    video.src = url;
  });
}

async function generateThumbnail(file: File, info: VideoInfo) {
  return generateThumbnailAt(file, info, 0.12);
}

export default function UploadPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [channels, setChannels] = useState<SupabaseChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelError, setChannelError] = useState("");
  const [channelId, setChannelId] = useState("");

  const [mode, setMode] = useState<UploadMode>("auto");
  const [step, setStep] = useState<Step>("media");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [language, setLanguage] = useState("English");
  const [visibility, setVisibility] = useState<
    "public" | "unlisted" | "private"
  >("public");
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [videoPreview, setVideoPreview] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);

  const [madeForKids, setMadeForKids] = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [allowDownload, setAllowDownload] = useState(false);
  const [ugcConfirmed, setUgcConfirmed] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [autoThumbnail, setAutoThumbnail] = useState(false);
  const [thumbnailFrame, setThumbnailFrame] = useState(0.12);

  const [recorderOpen, setRecorderOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>("user");

  const startedAtRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingVideoRef = useRef<HTMLVideoElement | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  const isClip =
    mode === "clip" ||
    (mode === "auto" &&
      Boolean(
        videoInfo &&
          videoInfo.height >= videoInfo.width &&
          videoInfo.duration <= 180
      ));
  const selectedChannel = useMemo(
    () => channels.find(channel => channel.id === channelId),
    [channels, channelId]
  );
  const modeLabel = isClip ? "Clip" : "Long Video";
  const canSubmit = Boolean(
    !uploading &&
      file &&
      title.trim() &&
      channelId &&
      videoInfo &&
      !channelsLoading &&
      ugcConfirmed
  );

  useEffect(() => {
    try {
      const draft = JSON.parse(
        localStorage.getItem(DRAFT_KEY) || "null"
      ) as Record<string, unknown> | null;
      if (!draft) return;
      if (typeof draft.title === "string") setTitle(draft.title);
      if (typeof draft.description === "string")
        setDescription(draft.description);
      if (typeof draft.category === "string") setCategory(draft.category);
      if (typeof draft.tags === "string") setTags(draft.tags);
      if (typeof draft.language === "string") setLanguage(draft.language);
      if (typeof draft.visibility === "string") {
        setVisibility(draft.visibility as "public" | "unlisted" | "private");
      }
      if (typeof draft.madeForKids === "boolean")
        setMadeForKids(draft.madeForKids);
      if (typeof draft.allowComments === "boolean")
        setAllowComments(draft.allowComments);
      if (typeof draft.allowDownload === "boolean")
        setAllowDownload(draft.allowDownload);
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        title,
        description,
        category,
        tags,
        language,
        visibility,
        madeForKids,
        allowComments,
        allowDownload,
      })
    );
  }, [
    title,
    description,
    category,
    tags,
    language,
    visibility,
    madeForKids,
    allowComments,
    allowDownload,
  ]);

  useEffect(() => {
    let active = true;
    if (!isAuthenticated) {
      setChannelsLoading(false);
      return;
    }

    setChannelsLoading(true);
    setChannelError("");

    void listMySupabaseChannels()
      .then(value => {
        if (!active) return;
        setChannels(value);
        setChannelId(current => current || value[0]?.id || "");
      })
      .catch(error => {
        if (active) setChannelError(friendlyUploadError(error));
      })
      .finally(() => {
        if (active) setChannelsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!thumbnail) {
      setThumbnailPreview("");
      return;
    }
    const url = URL.createObjectURL(thumbnail);
    setThumbnailPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [thumbnail]);

  useEffect(() => {
    if (!file) {
      setVideoPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setVideoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    return () => {
      recordingStreamRef.current?.getTracks().forEach(track => track.stop());
      if (recordingTimerRef.current)
        window.clearInterval(recordingTimerRef.current);
    };
  }, []);

  function cleanupRecordingStream() {
    recordingStreamRef.current?.getTracks().forEach(track => track.stop());
    recordingStreamRef.current = null;
    if (recordingVideoRef.current) recordingVideoRef.current.srcObject = null;
    if (recordingTimerRef.current)
      window.clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
  }

  async function openRecorder(facing: CameraFacing = cameraFacing) {
    if (uploading || recording) return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setNotice({
        type: "error",
        text: "Camera recording is not supported by this browser. Use Choose video instead.",
      });
      return;
    }

    cleanupRecordingStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isClip
          ? {
              facingMode: facing,
              width: { ideal: 1080 },
              height: { ideal: 1920 },
            }
          : {
              facingMode: facing,
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
        audio: true,
      });

      recordingStreamRef.current = stream;
      setRecorderOpen(true);

      window.setTimeout(() => {
        if (recordingVideoRef.current) {
          recordingVideoRef.current.srcObject = stream;
          void recordingVideoRef.current.play().catch(() => undefined);
        }
      }, 0);
    } catch {
      cleanupRecordingStream();
      setNotice({
        type: "error",
        text: "Camera or microphone permission was denied. Allow access in the browser or use Choose video.",
      });
    }
  }

  async function switchCamera() {
    if (recording) return;
    const nextFacing: CameraFacing =
      cameraFacing === "user" ? "environment" : "user";
    cleanupRecordingStream();
    setCameraFacing(nextFacing);
    await openRecorder(nextFacing);
  }

  function startRecording() {
    const stream = recordingStreamRef.current;
    if (!stream || recording) return;

    const preferred =
      [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ].find(type => MediaRecorder.isTypeSupported(type)) || "";

    try {
      const recorder = new MediaRecorder(
        stream,
        preferred ? { mimeType: preferred } : undefined
      );

      recordingChunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size) recordingChunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        cleanupRecordingStream();
        setRecording(false);
        setNotice({
          type: "error",
          text: "Camera recording failed. Your browser did not provide a usable recording.",
        });
      };

      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || "video/webm",
        });
        const recordedFile = new File(
          [blob],
          `HkTube-recording-${Date.now()}.webm`,
          { type: blob.type || "video/webm", lastModified: Date.now() }
        );

        cleanupRecordingStream();
        setRecording(false);
        setRecorderOpen(false);
        setRecordingSeconds(0);
        recorderRef.current = null;
        void chooseVideo(recordedFile, "recording");
      };

      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(
        () => setRecordingSeconds(value => value + 1),
        1000
      );
    } catch {
      setNotice({
        type: "error",
        text: "HkTube could not start the camera recorder on this device.",
      });
    }
  }

  function stopRecording() {
    if (!recorderRef.current || recorderRef.current.state === "inactive")
      return;
    recorderRef.current.stop();
    recorderRef.current = null;
  }

  function closeRecorder() {
    if (recording) {
      stopRecording();
      return;
    }
    cleanupRecordingStream();
    setRecorderOpen(false);
  }

  function formatRecordingTime(seconds: number) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  async function chooseVideo(
    next: File | undefined,
    source: "file" | "recording" = "file"
  ) {
    if (!next || uploading) return;

    setNotice(null);

    if (!ACCEPTED_VIDEO_TYPES.has(next.type.toLowerCase())) {
      setNotice({
        type: "error",
        text: "Use MP4/H.264 or WebM for reliable playback.",
      });
      return;
    }

    if (next.size <= 0 || next.size > MAX_VIDEO_BYTES) {
      setNotice({
        type: "error",
        text:
          next.size <= 0
            ? "The selected video is empty."
            : `Video must be 900 MB or smaller. This file is ${formatBytes(next.size)}.`,
      });
      return;
    }

    try {
      const info = await inspectVideo(next);
      const params = new URLSearchParams(window.location.search);
      const forcedClip = params.get("category") === "shorts" || mode === "clip";
      const inferredClip = info.height >= info.width && info.duration <= 180;

      if (forcedClip && info.width > info.height) {
        setNotice({
          type: "error",
          text: "Clip mode needs a vertical portrait video.",
        });
        return;
      }

      if (mode === "video" && info.width <= info.height) {
        setNotice({
          type: "error",
          text: "Long Video mode needs a landscape video.",
        });
        return;
      }

      if (
        (forcedClip || (mode === "auto" && inferredClip)) &&
        info.duration > 180
      ) {
        setNotice({ type: "error", text: "Clips are limited to 3 minutes." });
        return;
      }

      setFile(next);
      setVideoInfo(info);
      setMode(
        forcedClip
          ? "clip"
          : mode === "video"
            ? "video"
            : inferredClip
              ? "clip"
              : "video"
      );

      const generated = await generateThumbnailAt(next, info, thumbnailFrame);
      if (generated) {
        setThumbnail(generated);
        setAutoThumbnail(true);
      }

      const generatedTitle = title.trim() || titleFromFilename(next.name);
      if (!title.trim() && generatedTitle) setTitle(generatedTitle);

      setStep("details");
      if (source === "recording") {
        setNotice({
          type: "info",
          text: "Recording added to the publish flow. You can now edit the title, thumbnail and privacy settings before upload.",
        });
      } else if (mode === "auto" && inferredClip) {
        setNotice({
          type: "info",
          text: "Portrait video detected. HkTube selected Clip mode automatically.",
        });
      }
    } catch (error) {
      setFile(null);
      setVideoInfo(null);
      setNotice({ type: "error", text: friendlyUploadError(error) });
    }
  }

  async function chooseThumbnailFrame(position: number) {
    if (!file || !videoInfo || uploading) return;
    setThumbnailFrame(position);
    const generated = await generateThumbnailAt(file, videoInfo, position);
    if (generated) {
      setThumbnail(generated);
      setAutoThumbnail(true);
    }
  }

  function chooseThumbnail(next: File | undefined) {
    if (!next || uploading) return;

    if (!ACCEPTED_THUMBNAIL_TYPES.has(next.type.toLowerCase())) {
      setNotice({
        type: "error",
        text: "Thumbnail must be JPG, PNG, WebP, or AVIF.",
      });
      return;
    }

    if (next.size > MAX_THUMBNAIL_BYTES) {
      setNotice({
        type: "error",
        text: `Thumbnail must be 12 MB or smaller. This file is ${formatBytes(next.size)}.`,
      });
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

  function changeMode(next: UploadMode) {
    if (uploading) return;
    setMode(next);

    if (next === "clip" && videoInfo && videoInfo.width > videoInfo.height) {
      setNotice({
        type: "info",
        text: "Clip mode requires a vertical video. Select or record a portrait video.",
      });
    }

    if (next === "video" && videoInfo && videoInfo.width <= videoInfo.height) {
      setNotice({
        type: "info",
        text: "Long Video mode requires a landscape video. Select or record a landscape video.",
      });
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!isAuthenticated) {
      startLogin();
      return;
    }

    if (!file || !videoInfo) {
      setNotice({
        type: "error",
        text: "Choose or record a valid video first.",
      });
      setStep("media");
      return;
    }

    if (!channelId) {
      setNotice({ type: "error", text: "Create or select a channel first." });
      return;
    }

    if (!title.trim()) {
      setNotice({ type: "error", text: "Add a title before publishing." });
      return;
    }

    if (isClip && videoInfo.duration > 180) {
      setNotice({ type: "error", text: "Clips cannot exceed 180 seconds." });
      return;
    }

    if (!ugcConfirmed) {
      setNotice({ type: "error", text: "Confirm the HkTube community and applicable PTA rules before uploading." });
      return;
    }

    if (uploading) return;

    setUploading(true);
    setProgress(0);
    setEta(null);
    startedAtRef.current = Date.now();
    abortRef.current = new AbortController();

    setNotice({
      type: "info",
      text: "Preparing a resumable upload. Large files transfer in small chunks instead of restarting from zero.",
    });

    try {
      await trpc.moderation.check.mutate({
        title: title.trim(),
        description: description.trim(),
      });

      await createSupabaseVideo({
        channelId,
        title: title.trim(),
        description: description.trim(),
        category: category.trim() || null,
        language: language.trim() || null,
        tags: tags
          .split(",")
          .map(tag => tag.trim())
          .filter(Boolean),
        file,
        thumbnail,
        isShort: isClip,
        durationSeconds: videoInfo.duration,
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
            setEta((elapsed * (100 - value)) / value);
          }
        },
      });

      setProgress(100);
      setNotice({
        type: "success",
        text:
          visibility === "public"
            ? "Upload complete. Your video is published and linked to your channel."
            : "Upload complete and saved.",
      });

      localStorage.removeItem(DRAFT_KEY);
      setTitle("");
      setDescription("");
      setCategory("");
      setTags("");
      setFile(null);
      setThumbnail(null);
      setVideoInfo(null);
      setStep("media");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setNotice({
          type: "info",
          text: "Upload paused/cancelled. The resumable transfer record was kept so the same file can continue.",
        });
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

  function saveDraft() {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        title,
        description,
        category,
        tags,
        language,
        visibility,
        madeForKids,
        allowComments,
        allowDownload,
      })
    );
    setNotice({
      type: "success",
      text: "Draft settings saved on this device.",
    });
  }

  function resetComposer() {
    if (uploading) return;
    setFile(null);
    setThumbnail(null);
    setVideoInfo(null);
    setVideoPreview("");
    setThumbnailPreview("");
    setStep("media");
    setNotice(null);
  }

  if (authLoading) {
    return (
      <HkTubeShell title="Create">
        <div className="mx-auto grid min-h-[55vh] place-items-center">
          <Loader2 className="size-7 animate-spin text-violet-300" />
        </div>
      </HkTubeShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <HkTubeShell title="Create">
        <div className="mx-auto max-w-xl px-5 py-16 text-center">
          <UploadCloud className="mx-auto size-12 text-violet-300" />
          <h1 className="mt-5 text-3xl font-black text-white">
            Sign in to upload
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Uploads are connected to your channel and protected by your account.
          </p>
          <button
            type="button"
            onClick={startLogin}
            className="mt-6 rounded-full bg-violet-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-violet-400"
          >
            Sign in / Sign up
          </button>
        </div>
      </HkTubeShell>
    );
  }

  if (!channelsLoading && !channels.length) {
    return (
      <HkTubeShell title="Create">
        <div className="mx-auto max-w-xl px-5 py-12">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-semibold text-slate-300"
          >
            <ArrowLeft className="mr-1.5 size-4" />
            Back to Home
          </Link>
          <div className="mt-8 rounded-3xl border border-violet-300/15 bg-violet-500/[.05] p-8 text-center">
            <FileVideo2 className="mx-auto size-10 text-violet-300" />
            <h1 className="mt-4 text-2xl font-black text-white">
              Create your channel first
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Every upload needs an owner channel so viewers know where it came
              from.
            </p>
            {channelError && (
              <p className="mt-4 rounded-xl bg-rose-500/10 p-3 text-left text-xs text-rose-200">
                {channelError}
              </p>
            )}
            <Link
              href="/channel/create"
              className="mt-6 inline-flex rounded-full bg-violet-500 px-5 py-3 text-sm font-bold text-white"
            >
              Create channel
            </Link>
          </div>
        </div>
      </HkTubeShell>
    );
  }

  return (
    <HkTubeShell
      title="Create"
      subtitle="One polished composer for Long Videos, Clips and camera recording."
    >
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-7 lg:px-10">
        {notice && (
          <div
            role="alert"
            className={[
              "mb-5 flex items-start gap-3 rounded-2xl border p-4 text-sm transition-all duration-300",
              notice.type === "success"
                ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
                : notice.type === "error"
                  ? "border-rose-300/20 bg-rose-500/10 text-rose-100"
                  : "border-sky-300/20 bg-sky-500/10 text-sky-100",
            ].join(" ")}
          >
            {notice.type === "success" ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            ) : notice.type === "error" ? (
              <ShieldCheck className="mt-0.5 size-5 shrink-0" />
            ) : (
              <Sparkles className="mt-0.5 size-5 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        <section className="mb-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/[.12] via-white/[.03] to-fuchsia-500/[.08]">
          <div className="p-5 sm:p-7">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">
                  HkTube Creator
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                  Create once. Publish cleanly.
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Long-form uploads use a YouTube-style metadata flow. Clips use
                  a vertical short-form flow. Camera recording enters the exact
                  same publishing pipeline.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <ShieldCheck className="size-5 text-emerald-300" />
                <div>
                  <p className="text-xs font-bold text-white">
                    Protected upload
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Account + channel ownership
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-2 rounded-2xl bg-black/20 p-1.5 sm:grid-cols-3">
              <ModeButton
                active={mode === "video"}
                icon={<FileVideo2 className="size-5" />}
                title="Long Video"
                text="Landscape • full metadata"
                onClick={() => changeMode("video")}
              />
              <ModeButton
                active={mode === "clip"}
                icon={<Smartphone className="size-5" />}
                title="Clip"
                text="Portrait • up to 3 min"
                onClick={() => changeMode("clip")}
                accent="pink"
              />
              <ModeButton
                active={mode === "auto"}
                icon={<WandSparkles className="size-5" />}
                title="Smart Detect"
                text="Format chosen automatically"
                onClick={() => changeMode("auto")}
                accent="sky"
              />
            </div>
          </div>
        </section>

        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1">
          {(["media", "details"] as Step[]).map((item, index) => (
            <button
              key={item}
              type="button"
              onClick={() => (item === "media" || file) && setStep(item)}
              className={[
                "shrink-0 rounded-full border px-4 py-2 text-xs font-black transition-all duration-300",
                step === item
                  ? "border-violet-300/50 bg-violet-500 text-white shadow-lg shadow-violet-950/20"
                  : "border-white/10 bg-white/[.035] text-slate-500 hover:border-white/20 hover:text-slate-300",
              ].join(" ")}
            >
              {index + 1}. {item === "media" ? "Media" : "Details & publish"}
            </button>
          ))}
          <span className="ml-auto hidden text-xs text-slate-600 sm:block">
            {isClip ? "Short-form composer" : "Long-form composer"}
          </span>
        </div>

        <form
          onSubmit={submit}
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
        >
          <label className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[.04] p-4 text-sm text-slate-300">
            <input type="checkbox" checked={ugcConfirmed} onChange={e=>setUgcConfirmed(e.target.checked)} className="mt-1 size-4 accent-fuchsia-500" />
            <span>I confirm this content does not violate Pakistan PTA / Religious / 18+ rules.</span>
          </label>
          <div className="space-y-5">
            {step === "media" ? (
              <section className="rounded-3xl border border-white/10 bg-white/[.03] p-5 transition-all duration-300 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">
                      Step 1
                    </p>
                    <h2 className="mt-1 text-2xl font-black text-white">
                      Choose or record media
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      The composer validates orientation, duration, size and the
                      readable video track before the upload begins.
                    </p>
                  </div>
                  <Video className="size-8 text-violet-300" />
                </div>

                <div
                  onDragOver={event => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={onDrop}
                  className={[
                    "mt-6 rounded-3xl border-2 border-dashed p-7 text-center transition-all duration-300",
                    dragActive
                      ? "scale-[1.01] border-violet-300 bg-violet-500/10"
                      : "border-white/12 bg-black/15",
                  ].join(" ")}
                >
                  <input
                    id="video-file"
                    type="file"
                    accept="video/mp4,video/webm"
                    className="sr-only"
                    onChange={event =>
                      void chooseVideo(event.target.files?.[0])
                    }
                  />
                  <input
                    id="video-camera"
                    type="file"
                    accept="video/mp4,video/webm"
                    capture="environment"
                    className="sr-only"
                    onChange={event =>
                      void chooseVideo(event.target.files?.[0])
                    }
                  />

                  <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-violet-500/10">
                    <UploadCloud className="size-8 text-violet-300" />
                  </div>
                  <h3 className="mt-4 text-lg font-black text-white">
                    {file
                      ? file.name
                      : "Drop a video here or choose from your device"}
                  </h3>
                  <p className="mt-2 text-xs text-slate-500">
                    MP4/H.264 or WebM · up to 900 MB · resumable upload for
                    large files
                  </p>

                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <label
                      htmlFor="video-file"
                      className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-violet-500 px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-violet-400"
                    >
                      Choose video
                    </label>
                    <button
                      type="button"
                      onClick={() => void openRecorder()}
                      disabled={recording || uploading}
                      className="inline-flex min-h-11 items-center rounded-full border border-white/12 px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/[.06] disabled:opacity-50"
                    >
                      <Camera className="mr-2 size-4" />
                      Record in HkTube
                    </button>
                    <label
                      htmlFor="video-camera"
                      className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-white/12 px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/[.06]"
                    >
                      Camera file
                    </label>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <InfoCard
                    icon={<ShieldCheck className="size-4 text-emerald-300" />}
                    title="Pre-check"
                    text="Format, dimensions and readable track."
                  />
                  <InfoCard
                    icon={<UploadCloud className="size-4 text-violet-300" />}
                    title="Resumable"
                    text="Large files upload in small chunks."
                  />
                  <InfoCard
                    icon={<Sparkles className="size-4 text-sky-300" />}
                    title="Smart cover"
                    text="A thumbnail frame is generated automatically."
                  />
                </div>

                {file && videoInfo && (
                  <div className="mt-5 grid gap-4 sm:grid-cols-[190px_1fr]">
                    <div className="aspect-video overflow-hidden rounded-2xl bg-black">
                      {videoPreview && (
                        <video
                          src={videoPreview}
                          muted
                          controls
                          playsInline
                          className="size-full object-contain"
                        />
                      )}
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-black text-violet-200">
                          {modeLabel}
                        </span>
                        <span className="rounded-full bg-white/[.06] px-3 py-1 text-xs font-semibold text-slate-300">
                          {videoInfo.width}×{videoInfo.height}
                        </span>
                        <span className="rounded-full bg-white/[.06] px-3 py-1 text-xs font-semibold text-slate-300">
                          {formatDuration(videoInfo.duration)}
                        </span>
                        <span className="rounded-full bg-white/[.06] px-3 py-1 text-xs font-semibold text-slate-300">
                          {formatBytes(file.size)}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        The browser successfully read the media before upload.
                        This prevents many broken-video submissions.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setStep("details")}
                          className="rounded-full bg-white px-4 py-2 text-xs font-black text-black transition hover:-translate-y-0.5"
                        >
                          Continue
                        </button>
                        <button
                          type="button"
                          onClick={resetComposer}
                          className="inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-slate-300"
                        >
                          <RotateCcw className="mr-1.5 size-3.5" />
                          Replace
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            ) : (
              <section className="rounded-3xl border border-white/10 bg-white/[.03] p-5 transition-all duration-300 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">
                      Step 2
                    </p>
                    <h2 className="mt-1 text-2xl font-black text-white">
                      Details & publish
                    </h2>
                  </div>
                  <span className="rounded-full bg-violet-500/15 px-3 py-1.5 text-xs font-black text-violet-200">
                    {modeLabel}
                  </span>
                </div>

                <div className="mt-6 space-y-5">
                  <label className="block">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-black text-white">
                        Title <b className="text-rose-300">*</b>
                      </span>
                      <span className="text-[11px] text-slate-600">
                        {title.length}/100
                      </span>
                    </div>
                    <input
                      value={title}
                      onChange={event => setTitle(event.target.value)}
                      maxLength={100}
                      required
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-300/50"
                      placeholder={
                        isClip
                          ? "Write a strong Clip title"
                          : "Give your video a clear title"
                      }
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          file && setTitle(titleFromFilename(file.name))
                        }
                        className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-300 transition hover:bg-white/[.05]"
                      >
                        Use filename
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setTags(
                            suggestedTags(
                              title ||
                                (file ? titleFromFilename(file.name) : ""),
                              category
                            )
                          )
                        }
                        className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-300 transition hover:bg-white/[.05]"
                      >
                        Auto-generate tags
                      </button>
                    </div>
                  </label>

                  <label className="block">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-black text-white">
                        Description
                      </span>
                      <span className="text-[11px] text-slate-600">
                        {description.length}/5000
                      </span>
                    </div>
                    <textarea
                      value={description}
                      onChange={event => setDescription(event.target.value)}
                      maxLength={5000}
                      rows={7}
                      className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-300/50"
                      placeholder="Tell viewers what this video is about."
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FieldSelect
                      label="Channel"
                      value={channelId}
                      onChange={setChannelId}
                      options={channels.map(channel => ({
                        value: channel.id,
                        label: `${channel.displayName} (@${channel.handle})`,
                      }))}
                    />
                    <FieldSelect
                      label="Visibility"
                      value={visibility}
                      onChange={value =>
                        setVisibility(
                          value as "public" | "unlisted" | "private"
                        )
                      }
                      options={[
                        { value: "public", label: "Public · publish now" },
                        { value: "unlisted", label: "Unlisted" },
                        { value: "private", label: "Private" },
                      ]}
                    />
                    <FieldSelect
                      label="Category"
                      value={category}
                      onChange={setCategory}
                      options={[
                        { value: "", label: "Select category" },
                        { value: "Entertainment", label: "Entertainment" },
                        { value: "Gaming", label: "Gaming" },
                        { value: "Music", label: "Music" },
                        { value: "Education", label: "Education" },
                        { value: "Technology", label: "Technology" },
                        { value: "Sports", label: "Sports" },
                        { value: "News", label: "News" },
                        { value: "Comedy", label: "Comedy" },
                        { value: "How-to & Style", label: "How-to & Style" },
                        { value: "Travel", label: "Travel" },
                        { value: "Science", label: "Science" },
                        { value: "People & Blogs", label: "People & Blogs" },
                        {
                          value: "Film & Animation",
                          label: "Film & Animation",
                        },
                        { value: "Other", label: "Other" },
                      ]}
                    />
                    <FieldSelect
                      label="Language"
                      value={language}
                      onChange={setLanguage}
                      options={[
                        { value: "English", label: "English" },
                        { value: "Urdu", label: "Urdu" },
                        { value: "Hindi", label: "Hindi" },
                        { value: "Arabic", label: "Arabic" },
                        { value: "Punjabi", label: "Punjabi" },
                        { value: "Other", label: "Other" },
                      ]}
                    />
                  </div>

                  <label className="block">
                    <span className="text-sm font-black text-white">Tags</span>
                    <input
                      value={tags}
                      onChange={event => setTags(event.target.value)}
                      maxLength={500}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-300/50"
                      placeholder="gaming, tutorial, tech"
                    />
                    <span className="mt-1 block text-[11px] text-slate-600">
                      Separate tags with commas.
                    </span>
                  </label>

                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="flex items-center gap-3">
                      <ImagePlus className="size-5 text-violet-300" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-white">
                          Thumbnail
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {autoThumbnail
                            ? "Generated from the video. Replace it with your own cover when needed."
                            : "Use a custom thumbnail or keep the current one."}
                        </p>
                      </div>
                      <label className="cursor-pointer rounded-full border border-white/12 px-3 py-2 text-xs font-black text-white transition hover:bg-white/[.05]">
                        Change
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/avif"
                          className="sr-only"
                          onChange={event =>
                            chooseThumbnail(event.target.files?.[0])
                          }
                        />
                      </label>
                    </div>
                    {thumbnailPreview && (
                      <>
                        <img
                          src={thumbnailPreview}
                          alt="Video thumbnail preview"
                          className="mt-4 aspect-video w-full max-w-sm rounded-xl object-cover"
                        />
                        {file && videoInfo && (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="mr-1 text-[11px] font-bold text-slate-500">
                              Pick frame:
                            </span>
                            {[0.05, 0.2, 0.35, 0.5, 0.7, 0.9].map(position => (
                              <button
                                key={position}
                                type="button"
                                disabled={uploading}
                                onClick={() =>
                                  void chooseThumbnailFrame(position)
                                }
                                className={cn(
                                  "rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition",
                                  Math.abs(thumbnailFrame - position) < 0.001
                                    ? "border-violet-300/50 bg-violet-500/15 text-white"
                                    : "border-white/10 bg-white/[.03] text-slate-400 hover:bg-white/[.06]"
                                )}
                              >
                                {Math.round(position * 100)}%
                              </button>
                            ))}
                            <span className="text-[11px] text-slate-600">
                              Choose the frame where the subject/face is
                              positioned best.
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Toggle
                      checked={allowComments}
                      onChange={setAllowComments}
                      title="Allow comments"
                      text="Let viewers comment on this video."
                    />
                    <Toggle
                      checked={madeForKids}
                      onChange={setMadeForKids}
                      title="Made for kids"
                      text="Use this only when the content is specifically directed to children."
                    />
                    <Toggle
                      checked={allowDownload}
                      onChange={setAllowDownload}
                      title="Allow downloads"
                      text="Let eligible viewers save a copy when supported."
                    />
                    <div className="rounded-2xl border border-emerald-300/10 bg-emerald-500/[.04] p-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-emerald-300" />
                        <p className="text-xs font-black text-emerald-100">
                          Automatic checks
                        </p>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        HkTube validates media before the upload transaction is
                        created.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAdvancedOpen(value => !value)}
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/10 p-4 text-left transition hover:bg-white/[.04]"
                  >
                    <span className="flex items-center gap-3">
                      <Settings2 className="size-5 text-violet-300" />
                      <span>
                        <b className="block text-sm text-white">
                          More settings
                        </b>
                        <span className="mt-1 block text-xs text-slate-500">
                          Audience, comments and download controls
                        </span>
                      </span>
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {advancedOpen ? "Hide" : "Show"}
                    </span>
                  </button>

                  {advancedOpen && (
                    <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/10 p-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 p-3">
                        <p className="text-xs font-black text-white">
                          Audience
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Current audience declaration is stored with the video
                          metadata.
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 p-3">
                        <p className="text-xs font-black text-white">Privacy</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Public, unlisted and private visibility are available
                          before publishing.
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 p-3 sm:col-span-2">
                        <p className="text-xs font-black text-white">
                          Media architecture
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          The browser sends media to HkTube's Supabase Storage
                          backend using resumable transfer. Vercel serves the
                          application and deployment layer.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {uploading ? (
                  <div className="mt-6 rounded-2xl border border-violet-300/20 bg-violet-500/10 p-5">
                    <div className="flex items-center justify-between gap-4 text-sm font-black text-white">
                      <span>Uploading {modeLabel}…</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/30">
                      <div
                        className="h-full rounded-full bg-violet-400 transition-[width] duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span>{file ? formatBytes(file.size) : ""}</span>
                      <span>{formatEta(eta)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={cancelUpload}
                      className="mt-4 inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-xs font-black text-white"
                    >
                      <PauseCircle className="mr-2 size-4" />
                      Pause upload
                    </button>
                  </div>
                ) : (
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setStep("media")}
                      className="rounded-full border border-white/12 px-5 py-2.5 text-sm font-black text-white"
                    >
                      Back
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={saveDraft}
                        className="rounded-full border border-white/12 px-5 py-2.5 text-sm font-black text-slate-200"
                      >
                        Save draft
                      </button>
                      <button
                        type="submit"
                        disabled={!canSubmit}
                        className="inline-flex min-h-12 items-center rounded-full bg-violet-500 px-6 text-sm font-black text-white shadow-lg shadow-violet-950/20 transition hover:-translate-y-0.5 hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <UploadCloud className="mr-2 size-4" />
                        Publish {modeLabel}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>

          <aside className="space-y-4">
            <section className="sticky top-20 rounded-3xl border border-white/10 bg-white/[.03] p-5 transition-all duration-300">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">
                  Live preview
                </p>
                <span className="rounded-full bg-white/[.06] px-2.5 py-1 text-[10px] font-black text-slate-400">
                  {modeLabel}
                </span>
              </div>

              <div
                className={[
                  "mt-4 overflow-hidden rounded-2xl bg-black shadow-2xl shadow-black/30",
                  isClip ? "aspect-[9/16] max-h-[520px]" : "aspect-video",
                ].join(" ")}
              >
                {videoPreview ? (
                  <video
                    src={videoPreview}
                    poster={thumbnailPreview || undefined}
                    controls
                    muted
                    playsInline
                    className="size-full object-contain"
                  />
                ) : (
                  <div className="grid size-full min-h-44 place-items-center text-center text-xs text-slate-600">
                    <div>
                      <Play className="mx-auto mb-2 size-8" />
                      Your video preview appears here
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <p className="line-clamp-2 text-sm font-black text-white">
                  {title || "Your video title"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedChannel
                    ? `@${selectedChannel.handle}`
                    : "@yourchannel"}{" "}
                  · {videoInfo ? formatDuration(videoInfo.duration) : "0:00"}
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[.03] p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-300" />
                <p className="text-sm font-black text-white">
                  Upload reliability
                </p>
              </div>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-500">
                <li>• Large files use resumable 6 MB chunks.</li>
                <li>• Interrupted chunks retry automatically.</li>
                <li>
                  • The same transfer can continue when the stored upload URL is
                  valid.
                </li>
                <li>• Media is linked to the selected channel owner.</li>
                <li>
                  • Public videos are published after the metadata transaction
                  succeeds.
                </li>
              </ul>
            </section>

            <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-sky-500/[.07] to-violet-500/[.07] p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-sky-300" />
                <p className="text-sm font-black text-white">Creator flow</p>
              </div>
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                <p>
                  <span className="font-bold text-slate-300">1.</span> Choose or
                  record.
                </p>
                <p>
                  <span className="font-bold text-slate-300">2.</span> Validate
                  and generate cover.
                </p>
                <p>
                  <span className="font-bold text-slate-300">3.</span> Edit
                  title, metadata and privacy.
                </p>
                <p>
                  <span className="font-bold text-slate-300">4.</span> Resumable
                  upload.
                </p>
                <p>
                  <span className="font-bold text-slate-300">5.</span> Publish
                  to the selected channel.
                </p>
              </div>
            </section>
          </aside>
        </form>
      </main>

      {recorderOpen && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b0d13] shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">
                  HkTube Camera
                </p>
                <h3 className="mt-1 text-lg font-black text-white">
                  {isClip ? "Record a Clip" : "Record a Long Video"}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeRecorder}
                className="grid size-10 place-items-center rounded-full border border-white/10 text-slate-300 transition hover:bg-white/[.06]"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="relative grid place-items-center bg-black p-3">
              <video
                ref={recordingVideoRef}
                muted
                autoPlay
                playsInline
                className={[
                  "max-h-[62vh] w-full rounded-2xl object-contain",
                  isClip ? "aspect-[9/16] max-w-[360px]" : "aspect-video",
                ].join(" ")}
              />
              {recording && (
                <div className="absolute left-7 top-7 flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-xs font-black text-white backdrop-blur">
                  <span className="size-2 animate-pulse rounded-full bg-rose-400" />
                  {formatRecordingTime(recordingSeconds)}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
              <button
                type="button"
                onClick={() => void switchCamera()}
                disabled={recording}
                className="inline-flex items-center rounded-full border border-white/10 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"
              >
                <FlipHorizontal2 className="mr-2 size-4" />
                Switch camera
              </button>

              {recording ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="inline-flex items-center rounded-full bg-rose-500 px-5 py-2.5 text-sm font-black text-white transition hover:bg-rose-400"
                >
                  <Square className="mr-2 size-4 fill-current" />
                  Stop & use video
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="inline-flex items-center rounded-full bg-violet-500 px-5 py-2.5 text-sm font-black text-white transition hover:bg-violet-400"
                >
                  <Circle className="mr-2 size-4 fill-current" />
                  Start recording
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </HkTubeShell>
  );
}

function ModeButton({
  active,
  icon,
  title,
  text,
  onClick,
  accent = "violet",
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  text: string;
  onClick: () => void;
  accent?: "violet" | "pink" | "sky";
}) {
  const activeClass =
    accent === "pink"
      ? "border-pink-300/40 bg-pink-500/10"
      : accent === "sky"
        ? "border-sky-300/40 bg-sky-500/10"
        : "border-violet-300/40 bg-violet-500/10";

  const iconClass =
    accent === "pink"
      ? "text-pink-300"
      : accent === "sky"
        ? "text-sky-300"
        : "text-violet-300";

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border p-4 text-left transition-all duration-300",
        active
          ? activeClass
          : "border-transparent bg-transparent hover:border-white/10 hover:bg-white/[.04]",
      ].join(" ")}
    >
      <span className={iconClass}>{icon}</span>
      <b className="mt-2 block text-sm font-black text-white">{title}</b>
      <span className="mt-1 block text-xs text-slate-500">{text}</span>
    </button>
  );
}

function InfoCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[.04]">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs font-black text-white">{title}</p>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">{text}</p>
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label>
      <span className="text-sm font-black text-white">{label}</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-white/10 bg-[#151a25] px-4 py-3 text-sm text-white outline-none transition focus:border-violet-300/50"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  title,
  text,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  text: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/10 p-4 transition hover:bg-white/[.04]">
      <span
        className={[
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition",
          checked
            ? "border-violet-300/60 bg-violet-500 text-white"
            : "border-white/20 bg-black/20 text-transparent",
        ].join(" ")}
      >
        <Check className="size-3.5" />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        className="sr-only"
      />
      <span>
        <b className="block text-sm text-white">{title}</b>
        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {text}
        </span>
      </span>
    </label>
  );
}
