import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Check, FlipHorizontal, GalleryHorizontal, LoaderCircle, RotateCcw, Sparkles, Timer, Video, X } from "lucide-react";

type Filter = { name: string; css: string };
const FILTERS: Filter[] = [
  { name: "Original", css: "none" },
  { name: "Vivid", css: "saturate(1.45) contrast(1.08)" },
  { name: "Warm", css: "sepia(.24) saturate(1.2)" },
  { name: "Cool", css: "hue-rotate(12deg) saturate(.92)" },
  { name: "Mono", css: "grayscale(1)" },
  { name: "Vintage", css: "sepia(.4) saturate(.78) contrast(1.12)" },
];

type ShortCameraStudioProps = {
  onSelectFile: (file: File) => void;
  onChooseGallery: () => void;
  disabled?: boolean;
};

export function ShortCameraStudio({ onSelectFile, onChooseGallery, disabled = false }: ShortCameraStudioProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const animationRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const stopTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [filter, setFilter] = useState(FILTERS[0]);
  const [filterMenu, setFilterMenu] = useState(false);
  const [duration, setDuration] = useState<15 | 60 | 180>(15);
  const [timerSeconds, setTimerSeconds] = useState<0 | 3 | 10>(0);
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);

  const stopCamera = useCallback(() => {
    if (stopTimerRef.current !== null) window.clearInterval(stopTimerRef.current);
    stopTimerRef.current = null;
    if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = null;
    window.cancelAnimationFrame(animationRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async (nextFacing: "user" | "environment") => {
    setCameraError("");
    setCameraReady(false);
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access needs HTTPS and a browser that supports camera capture. Use Add to select an existing video.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: { ideal: nextFacing },
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : "";
      setCameraError(name === "NotAllowedError"
        ? "Camera or microphone permission was denied. Allow access in browser settings, or choose a video from your gallery."
        : "Camera could not start on this device. Use Add to choose a video from your gallery.");
    }
  }, []);

  useEffect(() => {
    void startCamera(facing);
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      stopCamera();
    };
  }, [facing, startCamera, stopCamera]);

  const drawFrames = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!video || !canvas || !context || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      animationRef.current = window.requestAnimationFrame(drawFrames);
      return;
    }
    const sourceWidth = video.videoWidth || 720;
    const sourceHeight = video.videoHeight || 1280;
    if (canvas.width !== sourceWidth || canvas.height !== sourceHeight) {
      canvas.width = Math.min(sourceWidth, 1080);
      canvas.height = Math.round(canvas.width * sourceHeight / sourceWidth);
    }
    context.save();
    context.filter = filter.css;
    const mirrored = facing === "user";
    if (mirrored) {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    const scale = Math.max(canvas.width / sourceWidth, canvas.height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    context.drawImage(video, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
    context.restore();
    animationRef.current = window.requestAnimationFrame(drawFrames);
  }, [facing, filter]);

  useEffect(() => {
    window.cancelAnimationFrame(animationRef.current);
    if (cameraReady) animationRef.current = window.requestAnimationFrame(drawFrames);
    return () => window.cancelAnimationFrame(animationRef.current);
  }, [cameraReady, drawFrames]);

  const startRecording = useCallback(async () => {
    if (disabled || busy || recording || !streamRef.current || !cameraReady) return;
    if (typeof MediaRecorder === "undefined" || !canvasRef.current?.captureStream) {
      setCameraError("This browser cannot record filtered video. Use a recent Chrome browser or select a video from your gallery.");
      return;
    }
    if (timerSeconds > 0) {
      setCountdown(timerSeconds);
      let remaining = timerSeconds;
      countdownTimerRef.current = window.setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          setCountdown(null);
          void recordNow();
        } else {
          setCountdown(remaining);
        }
      }, 1000);
      return;
    }
    await recordNow();
  }, [busy, cameraReady, disabled, recording, timerSeconds]);

  const recordNow = useCallback(async () => {
    const cameraStream = streamRef.current;
    const canvas = canvasRef.current;
    if (!cameraStream || !canvas || !canvas.captureStream) return;
    const supported = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      .find(type => MediaRecorder.isTypeSupported(type));
    if (!supported) {
      setCameraError("This browser does not support WebM recording. Choose an existing MP4 or WebM video instead.");
      return;
    }
    try {
      const output = canvas.captureStream(30);
      const audioTrack = cameraStream.getAudioTracks()[0];
      if (audioTrack) output.addTrack(audioTrack.clone());
      const recorder = new MediaRecorder(output, { mimeType: supported });
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setCameraError("Recording stopped unexpectedly. Please try again.");
        setRecording(false);
        setBusy(false);
        output.getTracks().forEach(track => track.stop());
      };
      recorder.onstop = () => {
        if (stopTimerRef.current !== null) window.clearInterval(stopTimerRef.current);
        stopTimerRef.current = null;
        output.getTracks().forEach(track => track.stop());
        setRecording(false);
        setBusy(false);
        if (!chunksRef.current.length) {
          setCameraError("No video was captured. Please try again.");
          return;
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        const file = new File([blob], "hktube-short-" + Date.now() + ".webm", { type: "video/webm", lastModified: Date.now() });
        onSelectFile(file);
      };
      recorder.start(250);
      startedAtRef.current = Date.now();
      setRecording(true);
      setBusy(true);
      setElapsed(0);
      stopTimerRef.current = window.setInterval(() => {
        const seconds = (Date.now() - startedAtRef.current) / 1000;
        setElapsed(seconds);
        if (seconds >= duration) {
          if (recorder.state !== "inactive") recorder.stop();
        }
      }, 100);
    } catch {
      setCameraError("Could not start recording. Check camera and microphone permissions.");
      setRecording(false);
      setBusy(false);
    }
  }, [duration, onSelectFile]);

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  };

  return (
    <section className="mx-auto w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-2xl">
      <div className="relative aspect-[9/16] max-h-[72dvh] min-h-[420px] overflow-hidden bg-[#171820]">
        <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 size-full object-cover" style={{ transform: facing === "user" ? "scaleX(-1)" : undefined, filter: filter.css }} />
        <canvas ref={canvasRef} className="pointer-events-none absolute -left-[10000px] top-0" aria-hidden="true" />
        <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-3">
          <button type="button" disabled={disabled || recording} onClick={stopCamera} className="grid size-11 place-items-center rounded-full bg-black/55 text-2xl text-white disabled:opacity-50" aria-label="Turn camera off"><X className="size-5" /></button>
          <span className="rounded-full bg-black/55 px-4 py-2 text-sm font-bold">HkTube <span className="text-violet-300">Shorts</span></span>
          <button type="button" disabled={disabled || recording} onClick={() => setFacing(value => value === "user" ? "environment" : "user")} className="grid size-11 place-items-center rounded-full bg-black/55 disabled:opacity-50" aria-label="Flip camera"><FlipHorizontal className="size-5" /></button>
        </div>

        <div className="absolute right-3 top-[25%] flex flex-col gap-1 rounded-full bg-black/55 p-1.5">
          <button type="button" disabled={recording} onClick={() => setTimerSeconds(value => value === 0 ? 3 : value === 3 ? 10 : 0)} className="flex min-h-12 flex-col items-center justify-center px-2 text-xs disabled:opacity-50" aria-label="Recording countdown"><Timer className="size-5" /><span>{timerSeconds ? timerSeconds + "s" : "Timer"}</span></button>
          <button type="button" disabled={recording} onClick={() => setDuration(value => value === 15 ? 60 : value === 60 ? 180 : 15)} className="flex min-h-12 flex-col items-center justify-center px-2 text-xs disabled:opacity-50"><Video className="size-5" /><span>{duration === 180 ? "3 min" : duration + "s"}</span></button>
          <button type="button" disabled={recording} onClick={() => setFilterMenu(value => !value)} className="flex min-h-12 flex-col items-center justify-center px-2 text-xs disabled:opacity-50"><Sparkles className="size-5" /><span>Filters</span></button>
        </div>

        {filterMenu && <div className="absolute bottom-5 left-3 right-3 grid grid-cols-3 gap-2 rounded-2xl bg-black/75 p-3 backdrop-blur">
          {FILTERS.map(item => <button key={item.name} type="button" onClick={() => setFilter(item)} className={"rounded-xl border px-2 py-3 text-xs font-bold " + (filter.name === item.name ? "border-violet-300 bg-violet-500/30 text-white" : "border-white/15 bg-white/5 text-slate-200")}>{item.name}</button>)}
        </div>}

        {countdown !== null && <div className="absolute inset-0 grid place-items-center bg-black/20 text-7xl font-black">{countdown}</div>}
        {recording && <div className="absolute left-4 top-20 rounded-full bg-red-600 px-3 py-1.5 text-xs font-black"><span className="mr-2 inline-block size-2 rounded-full bg-white" />REC {Math.floor(elapsed)}s</div>}
        {!cameraReady && <div className="absolute inset-0 grid place-items-center bg-black/80 p-8 text-center"><div><CameraOff className="mx-auto size-10 text-slate-400" /><p className="mt-3 text-sm text-slate-200">{cameraError || "Starting camera…"}</p><button type="button" onClick={() => void startCamera(facing)} className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-black text-black"><RotateCcw className="mr-2 inline size-4" />Retry camera</button></div></div>}
        {cameraError && cameraReady && <div role="alert" className="absolute bottom-20 left-3 right-3 rounded-xl bg-red-950/90 p-3 text-xs text-red-100">{cameraError}</div>}
      </div>

      <div className="bg-black px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <div className="flex items-center justify-between gap-3">
          <button type="button" disabled={disabled || recording} onClick={onChooseGallery} className="flex min-w-20 flex-col items-center gap-2 text-xs font-bold disabled:opacity-50"><span className="grid size-14 place-items-center overflow-hidden rounded-xl border border-white/15 bg-white/10"><GalleryHorizontal className="size-6" /></span>Add</button>
          <button type="button" disabled={!cameraReady || disabled || busy || countdown !== null} onClick={() => recording ? stopRecording() : void startRecording()} className={"grid size-[78px] place-items-center rounded-full border-[5px] border-white p-1 disabled:opacity-50 " + (recording ? "bg-red-600" : "bg-white")} aria-label={recording ? "Stop recording" : "Start recording"}>
            <span className={"block size-full bg-red-600 " + (recording ? "scale-50 rounded-lg" : "rounded-full")} />
          </button>
          <div className="flex min-w-20 flex-col items-center gap-1 text-xs text-slate-400"><span className="text-base font-bold text-white">{Math.min(duration, Math.floor(elapsed))}s</span><span>{recording ? "Recording" : "Max length"}</span></div>
        </div>
        <div className="mt-4 flex justify-center gap-2">
          <span className="rounded-full bg-white/15 px-5 py-2.5 text-sm font-bold text-white">Short</span>
          <button type="button" disabled={disabled || recording} onClick={onChooseGallery} className="rounded-full px-5 py-2.5 text-sm font-bold text-slate-400">Video</button>
        </div>
        <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">Camera filters are rendered into the recorded video. Gallery videos can be trimmed and exported with filters in the editor.</p>
        {cameraError && <p className="mt-2 text-center text-xs text-amber-200">{cameraError}</p>}
      </div>
    </section>
  );
}
