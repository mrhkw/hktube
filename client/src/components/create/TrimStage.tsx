import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { clampTrim, formatTrimTime, MIN_TRIM_SECONDS, type TrimRange } from "@/lib/videoEditor";

/**
 * Timeline trimmer.
 *
 * The filmstrip is sampled from the real video, and the two handles move the in
 * and out points. Playback is confined to the selection so the creator previews
 * exactly the range that will be encoded.
 */
export default function TrimStage({
  src,
  duration,
  trim,
  onTrimChange,
  onPlaybackRate,
}: {
  src: string;
  duration: number;
  trim: TrimRange;
  onTrimChange: (range: TrimRange) => void;
  onPlaybackRate?: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<null | "start" | "end" | "window">(null);
  const dragOrigin = useRef({ x: 0, start: 0, end: 0 });

  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [frames, setFrames] = useState<string[]>([]);
  const [sampling, setSampling] = useState(false);

  const selected = Math.max(0, trim.end - trim.start);

  /* ------------------------------------------------------------- filmstrip */

  useEffect(() => {
    if (!src || duration <= 0) return;
    let cancelled = false;
    setSampling(true);
    const probes: string[] = [];

    void (async () => {
      const sampler = document.createElement("video");
      sampler.preload = "auto";
      sampler.muted = true;
      sampler.playsInline = true;
      sampler.src = src;
      const cleanup = () => {
        sampler.removeAttribute("src");
        sampler.load();
        probes.forEach(url => URL.revokeObjectURL(url));
      };

      const ready = await new Promise<boolean>(resolve => {
        const done = (value: boolean) => resolve(value);
        sampler.addEventListener("loadedmetadata", () => done(true), { once: true });
        sampler.addEventListener("error", () => done(false), { once: true });
        window.setTimeout(() => done(sampler.videoWidth > 0), 2500);
      });
      if (cancelled || !ready) {
        cleanup();
        if (!cancelled) setSampling(false);
        return;
      }

      const canvas = document.createElement("canvas");
      const width = 72;
      const height = Math.max(40, Math.round((sampler.videoHeight / Math.max(sampler.videoWidth, 1)) * width));
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      const count = 8;

      for (let index = 0; index < count; index += 1) {
        if (cancelled) break;
        const at = (duration / count) * index + 0.05;
        await new Promise<void>(resolve => {
          const onSeeked = () => resolve();
          sampler.addEventListener("seeked", onSeeked, { once: true });
          sampler.currentTime = Math.min(at, Math.max(0, duration - 0.05));
          window.setTimeout(resolve, 700);
        });
        if (cancelled || !ctx) break;
        try {
          ctx.drawImage(sampler, 0, 0, width, height);
        } catch {
          break;
        }
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.6));
        if (blob) probes.push(URL.createObjectURL(blob));
      }

      if (!cancelled) {
        setFrames([...probes]);
        setSampling(false);
      }
      sampler.removeAttribute("src");
      sampler.load();
    })();

    return () => {
      cancelled = true;
    };
  }, [src, duration]);

  /* -------------------------------------------------------------- scrubbing */

  const seekPreview = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = Math.min(Math.max(seconds, trim.start), Math.max(trim.start, trim.end - 0.05));
      setPosition(video.currentTime);
    },
    [trim.start, trim.end]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = onPlaybackRate ?? 1;
  }, [onPlaybackRate]);

  function onTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    // Loop the preview inside the selection, the way a trimmer should.
    if (video.currentTime >= trim.end - 0.05) {
      video.currentTime = trim.start;
      setPosition(trim.start);
      return;
    }
    setPosition(video.currentTime);
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.currentTime < trim.start || video.currentTime >= trim.end - 0.05) {
        video.currentTime = trim.start;
      }
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }

  function ratioFromClientX(clientX: number): number {
    const track = trackRef.current;
    if (!track || duration <= 0) return 0;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }

  function beginDrag(kind: "start" | "end" | "window", event: ReactPointerEvent<HTMLElement>) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = kind;
    dragOrigin.current = { x: event.clientX, start: trim.start, end: trim.end };
  }

  function moveDrag(event: ReactPointerEvent<HTMLElement>) {
    const kind = dragRef.current;
    const track = trackRef.current;
    if (!kind || !track || duration <= 0) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const deltaSeconds = ((event.clientX - dragOrigin.current.x) / rect.width) * duration;

    if (kind === "start") {
      const start = Math.min(dragOrigin.current.start + deltaSeconds, dragOrigin.current.end - MIN_TRIM_SECONDS);
      onTrimChange(clampTrim({ start, end: dragOrigin.current.end }, duration));
      seekPreview(Math.max(0, start));
    } else if (kind === "end") {
      const end = Math.max(dragOrigin.current.end + deltaSeconds, dragOrigin.current.start + MIN_TRIM_SECONDS);
      onTrimChange(clampTrim({ start: dragOrigin.current.start, end }, duration));
      seekPreview(end);
    } else {
      const span = dragOrigin.current.end - dragOrigin.current.start;
      let start = dragOrigin.current.start + deltaSeconds;
      start = Math.min(Math.max(0, start), Math.max(0, duration - span));
      onTrimChange(clampTrim({ start, end: start + span }, duration));
      seekPreview(start);
    }
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const startPercent = duration > 0 ? (trim.start / duration) * 100 : 0;
  const endPercent = duration > 0 ? (trim.end / duration) * 100 : 100;
  const playPercent = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <>
      <div className="hkc-frame hkc-frame--vertical" style={{ width: "100%", height: "100%", aspectRatio: "auto" }}>
        <video
          ref={videoRef}
          src={src}
          playsInline
          preload="auto"
          style={{ objectFit: "contain" }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={onTimeUpdate}
          onClick={togglePlay}
        />
        {!playing && (
          <button
            type="button"
            className="hkc-icon-btn"
            onClick={togglePlay}
            aria-label="Play selection"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 58,
              height: 58,
              transform: "translate(-50%, -50%)",
              background: "rgb(0 0 0 / 55%)",
            }}
          >
            <Play className="size-6" />
          </button>
        )}
      </div>

      <div className="hkc-panel" style={{ maxHeight: "none" }}>
        <p className="hkc-label">Drag to adjust video</p>

        <div
          className="hkc-timeline"
          ref={trackRef}
          onPointerDown={event => {
            seekPreview(ratioFromClientX(event.clientX) * duration);
          }}
        >
          <div className="hkc-timeline-film">
            {(frames.length ? frames : Array.from({ length: 8 }, () => "")).map((frame, index) => (
              <span key={index} style={frame ? { backgroundImage: `url(${frame})` } : undefined} />
            ))}
          </div>

          <div className="hkc-timeline-shade" style={{ left: 0, width: `${startPercent}%` }} />
          <div className="hkc-timeline-shade" style={{ right: 0, width: `${Math.max(0, 100 - endPercent)}%` }} />

          <div
            className="hkc-timeline-window"
            style={{ left: `${startPercent}%`, width: `${Math.max(0, endPercent - startPercent)}%` }}
            onPointerDown={event => beginDrag("window", event)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <span
              className="hkc-timeline-handle hkc-timeline-handle--start"
              role="slider"
              aria-label="Trim start"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(trim.start)}
              onPointerDown={event => beginDrag("start", event)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
            <span
              className="hkc-timeline-handle hkc-timeline-handle--end"
              role="slider"
              aria-label="Trim end"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(trim.end)}
              onPointerDown={event => beginDrag("end", event)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
          </div>

          <div className="hkc-timeline-playhead" style={{ left: `${playPercent}%` }} />
        </div>

        <div className="hkc-trim-readout">
          <button type="button" className="hkc-trim-play" onClick={togglePlay}>
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {playing ? "Pause" : "Preview"}
          </button>
          <span>
            {formatTrimTime(trim.start)} – {formatTrimTime(trim.end)}
          </span>
          <span>
            {selected.toFixed(1)}s {sampling ? "· sampling…" : ""}
          </span>
        </div>

        <div className="hkc-chips" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="hkc-chip"
            onClick={() => onTrimChange(clampTrim({ start: 0, end: duration }, duration))}
          >
            Full clip
          </button>
          <button
            type="button"
            className="hkc-chip"
            onClick={() => {
              const current = videoRef.current?.currentTime ?? trim.start;
              onTrimChange(clampTrim({ start: current, end: Math.min(duration, current + 15) }, duration));
            }}
          >
            Next 15s
          </button>
          <button
            type="button"
            className="hkc-chip"
            onClick={() => {
              const current = videoRef.current?.currentTime ?? trim.start;
              onTrimChange(clampTrim({ start: current, end: Math.min(duration, current + 60) }, duration));
            }}
          >
            Next 60s
          </button>
        </div>
      </div>
    </>
  );
}
