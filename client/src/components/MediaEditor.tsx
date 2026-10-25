import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Scissors, Sparkles, Type } from "lucide-react";

type FilterId = "original" | "warm" | "cool" | "mono" | "vintage" | "vivid";

const FILTERS: Record<FilterId, { label: string; css: string }> = {
  original: { label: "Original", css: "none" },
  warm: { label: "Warm", css: "sepia(0.18) saturate(1.18) contrast(1.04)" },
  cool: { label: "Cool", css: "saturate(0.92) hue-rotate(12deg) contrast(1.05)" },
  mono: { label: "Mono", css: "grayscale(1)" },
  vintage: { label: "Vintage", css: "sepia(0.36) saturate(0.78) contrast(1.12)" },
  vivid: { label: "Vivid", css: "saturate(1.38) contrast(1.08)" },
};

type MediaEditorProps = {
  file: File;
  isShort: boolean;
  onApply: (file: File) => void;
};

function once(target: EventTarget, eventName: string) {
  return new Promise<void>((resolve, reject) => {
    const targetWithError = target as EventTarget & { error?: unknown };
    target.addEventListener(eventName, () => resolve(), { once: true });
    target.addEventListener("error", () => reject(targetWithError.error ?? new Error("Media could not be read.")), { once: true });
  });
}

async function exportEditedVideo(
  file: File,
  options: { start: number; end: number; filter: FilterId; overlay: string },
): Promise<File> {
  const duration = options.end - options.start;
  if (duration < 0.75) throw new Error("Keep at least 0.75 seconds of video.");
  if (duration > 600) throw new Error("On-device editing is limited to 10 minutes per export. Upload longer videos without browser-side edits.");

  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser cannot export edited video. Use a recent Chrome-based browser or upload the original file.");
  }

  const supportedTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  const mimeType = supportedTypes.find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw new Error("This browser does not support WebM video export. Upload the original video instead.");

  const sourceUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.playsInline = true;
  video.muted = false;

  let audioContext: AudioContext | null = null;
  let canvasStream: MediaStream | null = null;
  let animationFrame = 0;

  try {
    const metadataReady = once(video, "loadedmetadata");
    video.src = sourceUrl;
    await metadataReady;
    if (!video.videoWidth || !video.videoHeight || !Number.isFinite(video.duration)) {
      throw new Error("The selected file does not contain readable video metadata.");
    }

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    const scale = Math.min(1, 1280 / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, Math.floor(sourceWidth * scale / 2) * 2);
    canvas.height = Math.max(2, Math.floor(sourceHeight * scale / 2) * 2);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("The video editor could not allocate a rendering canvas.");

    if (!("captureStream" in canvas) || typeof canvas.captureStream !== "function") {
      throw new Error("This browser does not support video canvas export. Upload the original video instead.");
    }
    canvasStream = canvas.captureStream(30);

    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) {
      throw new Error("This browser cannot preserve the source audio during export. Upload the original video instead.");
    }
    audioContext = new AudioContextClass();
    const source = audioContext.createMediaElementSource(video);
    const audioDestination = audioContext.createMediaStreamDestination();
    const silentOutput = audioContext.createGain();
    silentOutput.gain.value = 0;
    source.connect(audioDestination);
    source.connect(silentOutput);
    silentOutput.connect(audioContext.destination);
    const audioTrack = audioDestination.stream.getAudioTracks()[0];
    if (!audioTrack) throw new Error("The source audio track could not be prepared.");
    canvasStream.addTrack(audioTrack);

    const drawFrame = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        context.save();
        context.filter = FILTERS[options.filter].css;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        context.restore();

        const overlay = options.overlay.trim().slice(0, 120);
        if (overlay) {
          const fontSize = Math.max(20, Math.min(52, Math.round(canvas.width / 18)));
          context.save();
          context.font = "800 " + fontSize + "px system-ui, sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          const textWidth = Math.min(canvas.width - 32, context.measureText(overlay).width + 34);
          const boxHeight = fontSize + 28;
          const x = (canvas.width - textWidth) / 2;
          const y = Math.max(12, canvas.height * 0.78 - boxHeight / 2);
          context.fillStyle = "rgba(0,0,0,0.58)";
          context.fillRect(x, y, textWidth, boxHeight);
          context.fillStyle = "#fff";
          context.fillText(overlay, canvas.width / 2, y + boxHeight / 2, canvas.width - 48);
          context.restore();
        }
      }
      if (video.currentTime >= options.end || video.ended) {
        if (recorder.state !== "inactive") recorder.stop();
        if (!video.paused) video.pause();
        return;
      }
      animationFrame = window.requestAnimationFrame(drawFrame);
    };

    await new Promise<void>((resolve, reject) => {
      const seekTarget = Math.min(options.start, Math.max(video.duration - 0.05, 0));
      if (Math.abs(video.currentTime - seekTarget) < 0.03) {
        resolve();
        return;
      }
      video.addEventListener("seeked", () => resolve(), { once: true });
      video.addEventListener("error", () => reject(new Error("The video could not seek to the trim start.")), { once: true });
      video.currentTime = seekTarget;
    });

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(canvasStream, { mimeType });
    const finished = new Promise<File>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        window.cancelAnimationFrame(animationFrame);
        if (video.currentTime < options.end && !video.paused) video.pause();
        if (error) {
          reject(error);
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
        if (!blob.size) {
          reject(new Error("The edited video export was empty. Try a shorter section or upload the original."));
          return;
        }
        const edited = new File(
          [blob],
          file.name.replace(/\.[^.]+$/, "") + "-edited.webm",
          { type: "video/webm", lastModified: Date.now() },
        );
        resolve(edited);
      };
      recorder.ondataavailable = event => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => finish(new Error("The browser stopped while exporting. Try a shorter clip."));
      recorder.onstop = () => finish();
      video.addEventListener("error", () => {
        if (recorder.state !== "inactive") recorder.stop();
        finish(new Error("The source video failed while editing."));
      }, { once: true });
    });

    const stopAtEnd = () => {
      if (video.currentTime >= options.end && recorder.state !== "inactive") {
        video.pause();
        recorder.stop();
      }
    };
    video.addEventListener("timeupdate", stopAtEnd);
    const timeout = window.setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, (duration + 15) * 1000);

    try {
      await audioContext.resume();
      recorder.start(500);
      await video.play();
      drawFrame();
      const edited = await finished;
      window.clearTimeout(timeout);
      video.removeEventListener("timeupdate", stopAtEnd);
      return edited;
    } catch (error) {
      window.clearTimeout(timeout);
      video.removeEventListener("timeupdate", stopAtEnd);
      if (recorder.state !== "inactive") recorder.stop();
      throw error;
    }
  } finally {
    window.cancelAnimationFrame(animationFrame);
    canvasStream?.getTracks().forEach(track => track.stop());
    if (audioContext && audioContext.state !== "closed") {
      await audioContext.close().catch(() => undefined);
    }
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(sourceUrl);
  }
}

export function MediaEditor({ file, isShort, onApply }: MediaEditorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [filter, setFilter] = useState<FilterId>("original");
  const [overlay, setOverlay] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  function onMetadata() {
    const nextDuration = Number(videoRef.current?.duration || 0);
    if (!Number.isFinite(nextDuration) || nextDuration <= 0) return;
    setDuration(nextDuration);
    setTrimStart(0);
    setTrimEnd(nextDuration);
    setFilter("original");
    setOverlay("");
    setError("");
  }

  async function applyEdits() {
    setError("");
    setProcessing(true);
    try {
      const edited = await exportEditedVideo(file, { start: trimStart, end: trimEnd || duration, filter, overlay });
      onApply(edited);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Video editing failed. Try the original file.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <section className="fixed inset-0 z-[110] h-[100dvh] w-screen overflow-y-auto overscroll-contain rounded-none border-0 bg-[#080a12] pb-[max(16px,env(safe-area-inset-bottom))] text-white sm:inset-3 sm:h-[calc(100dvh-24px)] sm:w-auto sm:rounded-2xl sm:border sm:border-violet-300/15">
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-[#101321]/95 px-4 py-3 backdrop-blur">
        <span className="grid size-9 place-items-center rounded-xl bg-violet-500/15 text-violet-200">
          <Scissors className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black text-white">Edit your video</h3>
          <p className="text-xs text-slate-400">Trim, preview filters and add text before continuing.</p>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold text-slate-300">
          {isShort ? "CLIP EDITOR" : "VIDEO EDITOR"}
        </span>
      </div>

      <div className="grid gap-4 p-3 sm:p-4 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className={isShort ? "mx-auto w-full max-w-[min(44dvh,360px)] sm:max-w-[min(68dvh,420px)]" : "mx-auto w-full max-w-5xl"}>
          <div className={"relative " + (isShort ? "aspect-[9/16] overflow-hidden rounded-xl bg-black" : "aspect-video overflow-hidden rounded-xl bg-black")}>
            <video
              ref={videoRef}
              src={previewUrl}
              controls
              playsInline
              onLoadedMetadata={onMetadata}
              style={{ filter: FILTERS[filter].css }}
              className="size-full object-contain"
            />
          </div>
          {overlay.trim() && (
            <div className="pointer-events-none absolute inset-x-3 bottom-[20%] rounded-lg bg-black/60 px-3 py-2 text-center text-sm font-black text-white">{overlay.slice(0, 120)}</div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-300"><Sparkles className="size-3.5" />Filters</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(FILTERS) as FilterId[]).map(id => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  aria-pressed={filter === id}
                  className={"rounded-lg border px-2 py-2 text-xs font-bold transition " + (filter === id ? "border-violet-300 bg-violet-500/20 text-white" : "border-white/10 bg-white/[.03] text-slate-400")}
                >
                  {FILTERS[id].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-300"><Scissors className="size-3.5" />Trim range</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-400">Start (seconds)
                <input type="number" min={0} max={Math.max(0, duration - 0.75)} step={0.1} value={trimStart} onChange={event => setTrimStart(Math.max(0, Math.min(Number(event.target.value) || 0, Math.max(0, duration - 0.75))))} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-sm text-white" />
              </label>
              <label className="text-xs text-slate-400">End (seconds)
                <input type="number" min={Math.min(duration, trimStart + 0.75)} max={duration} step={0.1} value={trimEnd} onChange={event => setTrimEnd(Math.min(duration, Math.max(trimStart + 0.75, Number(event.target.value) || duration)))} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-sm text-white" />
              </label>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Export keeps {Math.max(0, trimEnd - trimStart).toFixed(1)}s of video.</p>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-300"><Type className="size-3.5" />Text overlay</label>
            <input value={overlay} onChange={event => setOverlay(event.target.value.slice(0, 120))} maxLength={120} placeholder="Add text to the video" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-slate-600" />
          </div>

          <button type="button" onClick={() => void applyEdits()} disabled={processing || duration <= 0 || trimEnd - trimStart < 0.75 || duration > 600} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-violet-500 px-4 py-2 text-sm font-black text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50">
            {processing ? <><Loader2 className="mr-2 size-4 animate-spin" />Exporting edited video…</> : "Apply edits to video"}
          </button>
          {duration > 600 && <p className="text-xs leading-5 text-amber-200">Browser-side export is limited to 10 minutes to protect phone memory. Upload this long video without edits or trim it in a dedicated desktop editor.</p>}
          {error && <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-2 text-xs leading-5 text-rose-100">{error}</p>}
        </div>
      </div>
    </section>
  );
}
