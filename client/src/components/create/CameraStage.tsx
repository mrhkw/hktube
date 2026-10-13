import {
  Camera,
  Gauge,
  Images,
  SwitchCamera,
  Timer,
  Zap,
  ZapOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FILTER_PRESETS,
  exportCanvasSize,
  filterCss,
  pickRecordingMime,
  type FilterId,
} from "@/lib/videoEditor";

type Facing = "user" | "environment";

/** Countdown choices, in seconds. `0` records immediately. */
const TIMER_OPTIONS = [0, 3, 10] as const;
/** Playback-speed choices. Values above 1 speed the clip up, below slow it down. */
const SPEED_OPTIONS = [0.3, 0.5, 1, 2, 3] as const;
/** Recording length caps, in seconds. */
const LENGTH_OPTIONS = [15, 60, 180] as const;

export type CameraClip = {
  file: File;
  /** True when this browser's encoder produced WebM rather than MP4. */
  isWebm: boolean;
  durationSeconds: number;
  filter: FilterId;
  /**
   * Playback speed chosen on the camera. A live canvas recording cannot change
   * the footage's frame timing, so the studio applies this during the export
   * bake, where it genuinely retimes the file.
   */
  speed: number;
};

/**
 * TikTok-style capture screen.
 *
 * The preview is drawn to a canvas and the recorder films the *canvas*, not the
 * raw camera, so the selected filter is baked into the file the creator uploads
 * instead of only existing as a CSS effect over the preview.
 */
export default function CameraStage({
  vertical,
  filter,
  onFilterChange,
  onRecorded,
  onClose,
  onOpenGallery,
  galleryThumb,
}: {
  vertical: boolean;
  filter: FilterId;
  onFilterChange: (filter: FilterId) => void;
  onRecorded: (clip: CameraClip) => void;
  onClose: () => void;
  onOpenGallery: () => void;
  galleryThumb?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const frameRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const [facing, setFacing] = useState<Facing>("user");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timer, setTimer] = useState<(typeof TIMER_OPTIONS)[number]>(0);
  const [speed, setSpeed] = useState<(typeof SPEED_OPTIONS)[number]>(1);
  const [limit, setLimit] = useState<(typeof LENGTH_OPTIONS)[number]>(60);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [panel, setPanel] = useState<null | "timer" | "speed" | "length" | "filter">(null);

  /* -------------------------------------------------------------- camera feed */

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser cannot open the camera. Use the gallery instead.");
        return;
      }
      try {
        stopStream();
        setReady(false);
        setTorchAvailable(false);
        setTorchOn(false);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        // Torch is a real capability but is not present on most webcams, so the
        // button is only offered when the track actually reports it.
        const track = stream.getVideoTracks()[0];
        const capabilities = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        if (!cancelled && capabilities?.torch) setTorchAvailable(true);
      } catch (caught) {
        if (cancelled) return;
        const message =
          caught instanceof Error && caught.name === "NotAllowedError"
            ? "Camera permission was blocked. Allow it in your browser settings, or pick a video from the gallery."
            : "The camera could not be started. Use the gallery instead.";
        setError(message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [facing, stopStream]);

  useEffect(() => () => stopStream(), [stopStream]);

  /* ------------------------------------------------------------ preview pump */

  const drawPreview = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.videoWidth > 0) {
      const size = exportCanvasSize(video.videoWidth, video.videoHeight, { vertical, maxEdge: 1080 });
      if (canvas.width !== size.width || canvas.height !== size.height) {
        canvas.width = size.width;
        canvas.height = size.height;
      }
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.save();
        ctx.filter = filterCss(filter);
        if (facing === "user") {
          // Mirror the selfie preview the way every camera app does.
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        const ratio = canvas.width / canvas.height;
        const sourceRatio = video.videoWidth / video.videoHeight;
        let sx = 0;
        let sy = 0;
        let sw = video.videoWidth;
        let sh = video.videoHeight;
        if (sourceRatio > ratio) {
          sw = video.videoHeight * ratio;
          sx = (video.videoWidth - sw) / 2;
        } else {
          sh = video.videoWidth / ratio;
          sy = (video.videoHeight - sh) / 2;
        }
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
      setReady(true);
    }
    frameRef.current = requestAnimationFrame(drawPreview);
  }, [filter, facing, vertical]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(drawPreview);
    return () => cancelAnimationFrame(frameRef.current);
  }, [drawPreview]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  /* --------------------------------------------------------------- recording */

  const finishRecording = useCallback(
    (durationSeconds: number) => {
      const recorder = recorderRef.current;
      if (!recorder) return;
      const mimeType = recorder.mimeType || "video/webm";
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];
      recorderRef.current = null;
      if (blob.size === 0) {
        toast.error("The recording produced an empty file. Try again.");
        return;
      }
      const extension = mimeType.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `hktube-capture-${Date.now()}.${extension}`, { type: mimeType });
      onRecorded({
        file,
        isWebm: extension === "webm",
        durationSeconds,
        speed,
        filter,
      });
    },
    [filter, onRecorded]
  );

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const recorder = recorderRef.current;
    setRecording(false);
    setElapsed(current => {
      const captured = current;
      window.setTimeout(() => finishRecording(captured), 0);
      return captured;
    });
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, [finishRecording]);

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    const stream = streamRef.current;
    if (!canvas || !stream) return;
    if (typeof MediaRecorder === "undefined" || typeof canvas.captureStream !== "function") {
      toast.error("This browser cannot record video. Use the gallery instead.");
      return;
    }
    const mimeType = pickRecordingMime(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) {
      toast.error("This browser cannot encode video. Use the gallery instead.");
      return;
    }

    const output = new MediaStream(canvas.captureStream(30).getVideoTracks());
    // Keep the microphone so the Clip keeps its original sound.
    stream.getAudioTracks().forEach(track => output.addTrack(track));

    const recorder = new MediaRecorder(output, { mimeType, videoBitsPerSecond: 6_000_000 });
    chunksRef.current = [];
    recorder.ondataavailable = event => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.addEventListener("error", () => {
      toast.error("Recording failed on this device.");
      stopRecording();
    });
    recorderRef.current = recorder;
    setElapsed(0);
    setRecording(true);
    recorder.start(500);

    const startedAt = performance.now();
    timerRef.current = window.setInterval(() => {
      const seconds = (performance.now() - startedAt) / 1000;
      setElapsed(seconds);
      if (seconds >= limit) stopRecording();
    }, 100);
  }, [limit, stopRecording]);

  function pressShutter() {
    if (recording) {
      stopRecording();
      return;
    }
    if (timer === 0) {
      startRecording();
      return;
    }
    // Countdown: every camera app makes the wait visible, so mirror that.
    setCountdown(timer);
    let remaining = timer;
    const tick = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearInterval(tick);
        setCountdown(null);
        startRecording();
        return;
      }
      setCountdown(remaining);
    }, 1000);
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      // `torch` is a shipping capability that the DOM lib does not declare yet.
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
      toast.error("This camera does not expose a flash light to the browser.");
    }
  }

  const remaining = Math.max(0, limit - elapsed);

  return (
    <>
      <canvas ref={canvasRef} className="hkc-layer-media" style={{ width: "100%", height: "100%", display: "block" }} />
      <video ref={videoRef} muted playsInline className="sr-only" aria-hidden="true" />

      {recording && (
        <div className="hkc-rec-timer">
          <span className="hkc-rec-dot" />
          {remaining.toFixed(1)}s
        </div>
      )}

      {countdown !== null && <div className="hkc-countdown">{countdown}</div>}

      {!ready && !error && (
        <div className="hkc-empty" style={{ position: "absolute", inset: 0, placeContent: "center" }}>
          <Camera className="size-9" />
          Starting the camera…
        </div>
      )}

      {error && (
        <div className="hkc-empty" style={{ position: "absolute", inset: 0, placeContent: "center" }}>
          <Camera className="size-9" />
          <p>{error}</p>
          <button type="button" className="hkc-pill" onClick={onOpenGallery}>
            <Images className="size-4" />
            Pick from gallery
          </button>
        </div>
      )}

      {ready && !error && (
        <>
          <div className="hkc-camera-tools">
            <button type="button" className="hkc-tool" onClick={() => setFacing(f => (f === "user" ? "environment" : "user"))}>
              <span className="hkc-tool-icon">
                <SwitchCamera />
              </span>
              Flip
            </button>
            <button
              type="button"
              className={"hkc-tool" + (timer ? " is-on" : "")}
              onClick={() => setPanel(panel === "timer" ? null : "timer")}
            >
              <span className="hkc-tool-icon">
                <Timer />
              </span>
              {timer ? `${timer}s` : "Timer"}
            </button>
            <button
              type="button"
              className={"hkc-tool" + (speed !== 1 ? " is-on" : "")}
              onClick={() => setPanel(panel === "speed" ? null : "speed")}
            >
              <span className="hkc-tool-icon">
                <Gauge />
              </span>
              {speed === 1 ? "Speed" : `${speed}x`}
            </button>
            <button
              type="button"
              className={"hkc-tool" + (panel === "length" ? " is-on" : "")}
              onClick={() => setPanel(panel === "length" ? null : "length")}
            >
              <span className="hkc-tool-icon">
                <Timer />
              </span>
              {limit}s
            </button>
            <button
              type="button"
              className={"hkc-tool" + (filter !== "none" ? " is-on" : "")}
              onClick={() => setPanel(panel === "filter" ? null : "filter")}
            >
              <span className="hkc-tool-icon">
                <Zap />
              </span>
              Filters
            </button>
            {torchAvailable && (
              <button type="button" className={"hkc-tool" + (torchOn ? " is-on" : "")} onClick={() => void toggleTorch()}>
                <span className="hkc-tool-icon">{torchOn ? <Zap /> : <ZapOff />}</span>
                Flash
              </button>
            )}
          </div>

          <div className="hkc-camera-bar">
            <button type="button" className="hkc-gallery-btn" onClick={onOpenGallery}>
              <span className="hkc-gallery-thumb">
                {galleryThumb ? <img src={galleryThumb} alt="" /> : <Images className="size-5" />}
              </span>
              Gallery
            </button>

            <button
              type="button"
              className={"hkc-shutter" + (recording ? " is-recording" : "")}
              onClick={pressShutter}
              disabled={countdown !== null}
              aria-label={recording ? "Stop recording" : "Start recording"}
            >
              <span className="hkc-shutter-ring">
                <span className="hkc-shutter-core" />
              </span>
            </button>

            <button type="button" className="hkc-gallery-btn" onClick={onClose} aria-label="Close camera">
              <span className="hkc-gallery-thumb">
                <X className="size-5" />
              </span>
              Close
            </button>
          </div>
        </>
      )}

      {panel && (
        <div className="hkc-sheet" style={{ maxHeight: "46dvh" }}>
          <div className="hkc-sheet-head">
            <span className="hkc-sheet-title">
              {panel === "timer" ? "Countdown" : panel === "speed" ? "Recording speed" : panel === "length" ? "Clip length" : "Filters"}
            </span>
            <button type="button" className="hkc-icon-btn" onClick={() => setPanel(null)} aria-label="Close">
              <X />
            </button>
          </div>
          <div className="hkc-sheet-body">
            {panel === "filter" ? (
              <>
                <div className="hkc-filter-row">
                  {FILTER_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      className={"hkc-filter-btn" + (filter === preset.id ? " is-active" : "")}
                      onClick={() => onFilterChange(preset.id)}
                    >
                      <span className="hkc-filter-swatch" style={{ filter: preset.css }} />
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="hkc-note">
                  The filter is baked into the recording itself, so the uploaded Clip looks exactly
                  like this preview.
                </p>
              </>
            ) : (
              <div className="hkc-chips">
                {(panel === "timer" ? TIMER_OPTIONS : panel === "speed" ? SPEED_OPTIONS : LENGTH_OPTIONS).map(value => {
                  const active =
                    panel === "timer" ? timer === value : panel === "speed" ? speed === value : limit === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      className={"hkc-chip" + (active ? " is-active" : "")}
                      onClick={() => {
                        if (panel === "timer") setTimer(value as (typeof TIMER_OPTIONS)[number]);
                        else if (panel === "speed") setSpeed(value as (typeof SPEED_OPTIONS)[number]);
                        else setLimit(value as (typeof LENGTH_OPTIONS)[number]);
                        setPanel(null);
                      }}
                    >
                      {panel === "speed"
                        ? `${value}x`
                        : panel === "timer"
                          ? value === 0
                            ? "Off"
                            : `${value}s`
                          : `${value}s`}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
