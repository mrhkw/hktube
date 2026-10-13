import {
  Activity,
  Check,
  ChevronRight,
  LoaderCircle,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RectangleHorizontal,
  RotateCcw,
  RotateCw,
  Settings,
  SkipForward,
  Subtitles,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import "@/styles/player.css";

/**
 * YouTube-style long-form player.
 *
 * The page owns everything about the *video* — fetching, view counting, watch
 * history, discovery events, error reporting — and passes its `<video>` handlers
 * straight through, so replacing the browser's native controls with this chrome
 * changed no behaviour. This component owns only presentation and input.
 *
 * Honest data note: HkTube publishes a single progressive file per video. There
 * is no HLS ladder and no caption track, so the settings menu offers real
 * playback speed and reports the true single source instead of inventing
 * "1080p/720p/480p" rungs, and "Stats for nerds" reads only measurements the
 * browser actually reports.
 */

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const HIDE_CONTROLS_AFTER_MS = 3000;
const SEEK_STEP_SECONDS = 10;
const ARROW_STEP_SECONDS = 5;
const VOLUME_KEY_STEP = 0.05;

const VOLUME_KEY = "hktube-player-volume";
const MUTED_KEY = "hktube-player-muted";
const RATE_KEY = "hktube-player-rate";

/** `83` → `1:23`, `3723` → `1:02:03`. Non-finite input renders as `0:00`. */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

/** Reads a persisted number, falling back when the stored value is unusable. */
function readStoredNumber(key: string, fallback: number): number {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

type VideoEventProps = {
  onLoadedMetadata?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onLoadedData?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onPlay?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onPause?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onTimeUpdate?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onEnded?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onError?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
};

export type YouTubePlayerProps = VideoEventProps & {
  src: string;
  poster?: string;
  title: string;
  /** Extra class on the frame, e.g. `hktube-watch-frame--long`. */
  frameClassName?: string;
  /** Vertical 9:16 presentation for Clips played inside the watch page. */
  isShort?: boolean;
  videoRef?: RefObject<HTMLVideoElement | null>;
  /** Start the countdown to the next video when this one finishes. */
  onNext?: () => void;
  nextLabel?: string;
  hasNext?: boolean;
  /** Lets the page widen the layout when theater mode is toggled. */
  onTheaterChange?: (theater: boolean) => void;
  /** Rendered top-left inside the player, e.g. a channel link. */
  overlayTop?: ReactNode;
  /** Attempt to play as soon as the page allows it. */
  autoPlay?: boolean;
};

export default function YouTubePlayer({
  src,
  poster,
  title,
  frameClassName = "",
  isShort = false,
  videoRef,
  onNext,
  nextLabel,
  hasNext = false,
  onTheaterChange,
  overlayTop,
  autoPlay = false,
  onLoadedMetadata,
  onLoadedData,
  onPlay,
  onPause,
  onTimeUpdate,
  onEnded,
  onError,
}: YouTubePlayerProps) {
  const localRef = useRef<HTMLVideoElement | null>(null);
  const player = videoRef ?? localRef;

  const shellRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const hideTimer = useRef<number | null>(null);
  const lastTapRef = useRef<{ side: "left" | "right"; at: number }>({ side: "left", at: 0 });
  const singleTapTimer = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [rate, setRate] = useState(1);
  const [waiting, setWaiting] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState<null | "root" | "speed" | "quality">(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [theater, setTheater] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasCaptions, setHasCaptions] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [seekFlash, setSeekFlash] = useState<null | { side: "left" | "right"; seconds: number }>(null);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  /** Countdown before autoplaying the next video, in seconds; null when idle. */
  const [nextIn, setNextIn] = useState<number | null>(null);
  const [stats, setStats] = useState({
    dropped: 0,
    total: 0,
    width: 0,
    height: 0,
  });

  /* ---------------------------------------------------------------- restore */

  useEffect(() => {
    const storedVolume = clamp(readStoredNumber(VOLUME_KEY, 1), 0, 1);
    const storedMuted = readStoredNumber(MUTED_KEY, 0) === 1;
    let storedRate = readStoredNumber(RATE_KEY, 1);
    if (!PLAYBACK_RATES.includes(storedRate as (typeof PLAYBACK_RATES)[number])) storedRate = 1;
    setVolume(storedVolume);
    setMuted(storedMuted);
    setRate(storedRate);
    const element = player.current;
    if (element) {
      element.volume = storedVolume;
      element.muted = storedMuted;
      element.playbackRate = storedRate;
    }
  }, [player]);

  useEffect(() => {
    try {
      window.localStorage.setItem(VOLUME_KEY, String(volume));
      window.localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
      window.localStorage.setItem(RATE_KEY, String(rate));
    } catch {
      // Private mode or a full quota: the player still works, it just forgets.
    }
  }, [volume, muted, rate]);

  /* ------------------------------------------------------------- operations */

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      // Keep the bar pinned while paused, while a menu is open, or mid-drag.
      const element = player.current;
      if (!element || element.paused) return;
      if (settingsOpen || statsOpen || scrubTime !== null) return;
      setControlsVisible(false);
    }, HIDE_CONTROLS_AFTER_MS);
  }, [player, settingsOpen, statsOpen, scrubTime]);

  const togglePlay = useCallback(() => {
    const element = player.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => undefined);
    else element.pause();
    showControls();
  }, [player, showControls]);

  const seekTo = useCallback(
    (seconds: number) => {
      const element = player.current;
      if (!element) return;
      const limit = Number.isFinite(element.duration) ? element.duration : 0;
      element.currentTime = clamp(seconds, 0, Math.max(0, limit - 0.05));
      setCurrentTime(element.currentTime);
      setNextIn(null);
    },
    [player]
  );

  const seekBy = useCallback(
    (delta: number) => {
      const element = player.current;
      if (!element) return;
      seekTo(element.currentTime + delta);
    },
    [player, seekTo]
  );

  /** Shared by double-tap and the j/l keys: seeks and shows the ±N overlay. */
  const nudge = useCallback(
    (side: "left" | "right") => {
      const delta = side === "left" ? -SEEK_STEP_SECONDS : SEEK_STEP_SECONDS;
      seekBy(delta);
      setSeekFlash({ side, seconds: SEEK_STEP_SECONDS });
      window.setTimeout(() => setSeekFlash(null), 620);
    },
    [seekBy]
  );

  const applyVolume = useCallback(
    (next: number, unmute = true) => {
      const element = player.current;
      const value = clamp(next, 0, 1);
      setVolume(value);
      if (element) element.volume = value;
      if (unmute && value > 0 && muted) {
        setMuted(false);
        if (element) element.muted = false;
      }
      if (value === 0) {
        setMuted(true);
        if (element) element.muted = true;
      }
    },
    [player, muted]
  );

  const toggleMute = useCallback(() => {
    const element = player.current;
    const next = !muted;
    setMuted(next);
    if (element) element.muted = next;
    // Unmuting at zero would silence the clip anyway, so restore an audible level.
    if (!next && volume === 0) applyVolume(0.5, false);
  }, [player, muted, volume, applyVolume]);

  const toggleFullscreen = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void shell.requestFullscreen().catch(() => undefined);
  }, []);

  const toggleCaptions = useCallback(() => {
    const element = player.current;
    if (!element || element.textTracks.length === 0) return;
    const track = element.textTracks[0];
    const next = track.mode !== "showing";
    track.mode = next ? "showing" : "hidden";
    setCaptionsOn(next);
  }, [player]);

  const toggleMiniplayer = useCallback(() => {
    const element = player.current;
    if (!element) return;
    const doc = document as Document & { pictureInPictureElement?: Element | null; exitPictureInPicture?: () => Promise<void> };
    if (doc.pictureInPictureElement) {
      void doc.exitPictureInPicture?.().catch(() => undefined);
      return;
    }
    const request = (element as HTMLVideoElement & { requestPictureInPicture?: () => Promise<unknown> }).requestPictureInPicture;
    if (typeof request !== "function") return;
    void request.call(element).catch(() => undefined);
  }, [player]);

  const goNext = useCallback(() => {
    setNextIn(null);
    onNext?.();
  }, [onNext]);

  const setRateTo = useCallback(
    (next: number) => {
      const element = player.current;
      setRate(next);
      if (element) element.playbackRate = next;
    },
    [player]
  );

  const toggleTheater = useCallback(() => {
    setTheater(value => {
      const next = !value;
      onTheaterChange?.(next);
      return next;
    });
  }, [onTheaterChange]);

  // Leaving the page must not leave the layout widened.
  useEffect(() => () => onTheaterChange?.(false), [onTheaterChange]);

  /* ----------------------------------------------------------------- inputs */

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      // Never hijack typing, and never fight a menu that owns the arrow keys.
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      const element = player.current;
      if (!element) return;

      const toggle = () => togglePlay();
      switch (event.key) {
        case " ":
        case "k":
        case "K":
          event.preventDefault();
          toggle();
          return;
        case "j":
        case "J":
          event.preventDefault();
          nudge("left");
          return;
        case "l":
        case "L":
          event.preventDefault();
          nudge("right");
          return;
        case "ArrowLeft":
          event.preventDefault();
          seekBy(-ARROW_STEP_SECONDS);
          showControls();
          return;
        case "ArrowRight":
          event.preventDefault();
          seekBy(ARROW_STEP_SECONDS);
          showControls();
          return;
        case "ArrowUp":
          event.preventDefault();
          applyVolume(element.volume + VOLUME_KEY_STEP);
          showControls();
          return;
        case "ArrowDown":
          event.preventDefault();
          applyVolume(element.volume - VOLUME_KEY_STEP);
          showControls();
          return;
        case "m":
        case "M":
          event.preventDefault();
          toggleMute();
          showControls();
          return;
        case "f":
        case "F":
          event.preventDefault();
          toggleFullscreen();
          return;
        case "t":
        case "T":
          event.preventDefault();
          toggleTheater();
          return;
        case "c":
        case "C":
          event.preventDefault();
          toggleCaptions();
          return;
        case "i":
        case "I":
          event.preventDefault();
          toggleMiniplayer();
          return;
        case "Home":
          event.preventDefault();
          seekTo(0);
          return;
        case "End":
          event.preventDefault();
          seekTo(element.duration);
          return;
        case ">":
        case ".":
          if (!event.shiftKey) return;
          event.preventDefault();
          setRateTo(nextRate(rate, 1));
          return;
        case "<":
        case ",":
          if (!event.shiftKey) return;
          event.preventDefault();
          setRateTo(nextRate(rate, -1));
          return;
        default:
          break;
      }
      // 0-9 jump to that tenth of the video, exactly like YouTube.
      if (/^[0-9]$/.test(event.key) && Number.isFinite(element.duration)) {
        event.preventDefault();
        seekTo((element.duration * Number(event.key)) / 10);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    player,
    rate,
    togglePlay,
    nudge,
    seekBy,
    seekTo,
    showControls,
    toggleMute,
    applyVolume,
    toggleFullscreen,
    toggleCaptions,
    toggleMiniplayer,
    toggleTheater,
    setRateTo,
  ]);

  useEffect(() => {
    function sync() {
      setIsFullscreen(Boolean(document.fullscreenElement) && document.fullscreenElement === shellRef.current);
    }
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // Probe the element for a real caption track once metadata is known.
  useEffect(() => {
    const element = player.current;
    if (!element) return;
    const sync = () => setHasCaptions(element.textTracks.length > 0);
    sync();
    element.textTracks.addEventListener?.("addtrack", sync);
    return () => element.textTracks.removeEventListener?.("addtrack", sync);
  }, [player, src]);

  useEffect(() => {
    if (nextIn === null) return;
    if (nextIn <= 0) {
      goNext();
      return;
    }
    const timer = window.setTimeout(() => setNextIn(value => (value === null ? null : value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [nextIn, goNext]);

  useEffect(() => {
    if (statsOpen) setStatsOpen(false);
    // Closing the settings menu should also drop any open submenu.
    if (!settingsOpen) return;
    const close = (event: MouseEvent) => {
      if (shellRef.current && !shellRef.current.contains(event.target as Node)) setSettingsOpen(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [statsOpen, settingsOpen]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (singleTapTimer.current) window.clearTimeout(singleTapTimer.current);
    };
  }, []);

  // Re-read real playback data periodically while the stats panel is open.
  useEffect(() => {
    if (!statsOpen) return;
    const tick = () => {
      const element = player.current;
      if (!element) return;
      const quality = (
        element as HTMLVideoElement & {
          getVideoPlaybackQuality?: () => { droppedVideoFrames: number; totalVideoFrames: number };
        }
      ).getVideoPlaybackQuality?.();
      setStats({
        dropped: quality?.droppedVideoFrames ?? 0,
        total: quality?.totalVideoFrames ?? 0,
        width: element.videoWidth,
        height: element.videoHeight,
      });
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [statsOpen, player]);

  /* ------------------------------------------------------------------ render */

  const progressPercent = duration > 0 ? clamp((scrubTime ?? currentTime) / duration, 0, 1) * 100 : 0;
  const bufferedPercent = duration > 0 ? clamp(bufferedEnd / duration, 0, 1) * 100 : 0;
  const activeTime = scrubTime ?? currentTime;
  const remaining = useMemo(() => (duration > 0 ? Math.max(0, duration - activeTime) : 0), [duration, activeTime]);
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  function seekFromClientX(clientX: number): number | null {
    const bar = barRef.current;
    if (!bar || duration <= 0) return null;
    const rect = bar.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return ratio * duration;
  }

  function onBarPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = seekFromClientX(event.clientX);
    if (target === null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setScrubTime(target);
  }

  function onBarPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const hovered = seekFromClientX(event.clientX);
    setHoverTime(hovered);
    if (scrubTime === null || hovered === null) return;
    setScrubTime(hovered);
  }

  function onBarPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (scrubTime !== null) seekTo(scrubTime);
    setScrubTime(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onSurfaceClick(event: React.MouseEvent<HTMLDivElement>) {
    // A click that lands on a control should not also toggle playback.
    if ((event.target as HTMLElement).closest("[data-player-control]")) return;
    // YouTube distinguishes a single click (play/pause) from a double click
    // (seek). Deferring the toggle by the double-click window is what makes the
    // two gestures coexist.
    if (singleTapTimer.current) {
      window.clearTimeout(singleTapTimer.current);
      singleTapTimer.current = null;
      return;
    }
    singleTapTimer.current = window.setTimeout(() => {
      singleTapTimer.current = null;
      togglePlay();
    }, 220);
  }

  function onSurfaceDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-player-control]")) return;
    if (singleTapTimer.current) {
      window.clearTimeout(singleTapTimer.current);
      singleTapTimer.current = null;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const side = event.clientX - rect.left < rect.width / 2 ? "left" : "right";
    lastTapRef.current = { side, at: Date.now() };
    nudge(side);
  }

  return (
    <div
      ref={shellRef}
      className={`ytp-shell ${isShort ? "ytp-shell--short" : ""} ${theater ? "ytp-shell--theater" : ""} ${controlsVisible || !playing ? "is-controls-visible" : ""}`}
      onPointerMove={showControls}
      onPointerLeave={() => {
        const element = player.current;
        if (element && !element.paused && !settingsOpen && !statsOpen) setControlsVisible(false);
      }}
    >
      <div className={frameClassName} data-ytp-frame="">
        <video
          ref={player as RefObject<HTMLVideoElement>}
          src={src}
          poster={poster}
          playsInline
          autoPlay={autoPlay}
          preload="metadata"
          className="hktube-watch-video ytp-video"
          onClick={undefined}
          onLoadedMetadata={event => {
            const element = event.currentTarget;
            setDuration(Number.isFinite(element.duration) ? element.duration : 0);
            element.playbackRate = rate;
            element.volume = volume;
            element.muted = muted;
            onLoadedMetadata?.(event);
          }}
          onLoadedData={event => {
            setStarted(true);
            onLoadedData?.(event);
          }}
          onPlay={event => {
            setPlaying(true);
            setNextIn(null);
            showControls();
            onPlay?.(event);
          }}
          onPause={event => {
            setPlaying(false);
            setControlsVisible(true);
            onPause?.(event);
          }}
          onWaiting={() => setWaiting(true)}
          onPlaying={() => setWaiting(false)}
          onCanPlay={() => setWaiting(false)}
          onProgress={event => {
            const element = event.currentTarget;
            if (element.buffered.length > 0) {
              setBufferedEnd(element.buffered.end(element.buffered.length - 1));
            }
          }}
          onTimeUpdate={event => {
            const element = event.currentTarget;
            if (scrubTime === null) setCurrentTime(element.currentTime);
            if (element.buffered.length > 0) {
              setBufferedEnd(element.buffered.end(element.buffered.length - 1));
            }
            onTimeUpdate?.(event);
          }}
          onEnded={event => {
            setPlaying(false);
            setControlsVisible(true);
            if (hasNext && onNext && readStoredNumber("hktube-long-autoplay", 1) !== 0) setNextIn(5);
            onEnded?.(event);
          }}
          onError={event => {
            setWaiting(false);
            setPlaying(false);
            onError?.(event);
          }}
        />

        {/* Interaction surface: click toggles, double-click seeks, drag to scrub. */}
        <div
          className="ytp-surface"
          onClick={onSurfaceClick}
          onDoubleClick={onSurfaceDoubleClick}
          role="presentation"
        />

        {seekFlash && (
          <div className={`ytp-seek-flash ytp-seek-flash--${seekFlash.side}`} aria-hidden="true">
            <div className="ytp-seek-ripple" />
            {seekFlash.side === "left" ? (
              <>
                <RotateCcw className="ytp-seek-glyph" />
                <span>{seekFlash.seconds} seconds</span>
              </>
            ) : (
              <>
                <RotateCw className="ytp-seek-glyph" />
                <span>{seekFlash.seconds} seconds</span>
              </>
            )}
          </div>
        )}

        {waiting && !seekFlash && (
          <div className="ytp-spinner" role="status" aria-label="Buffering">
            <LoaderCircle />
          </div>
        )}

        {!playing && started && !nextIn && (
          <button type="button" className="ytp-big-play" onClick={togglePlay} aria-label="Play video" data-player-control>
            <Play />
          </button>
        )}

        {!started && (
          <button type="button" className="ytp-big-play" onClick={togglePlay} aria-label="Play video" data-player-control>
            <Play />
          </button>
        )}

        {nextIn !== null && (
          <div className="ytp-next-overlay">
            <p className="ytp-next-label">
              Up next{nextLabel ? `: ${nextLabel}` : ""}
            </p>
            <div className="ytp-next-actions">
              <button type="button" className="ytp-next-play" onClick={goNext} data-player-control>
                <Play className="size-4" />
                Play now
              </button>
              <p className="ytp-next-countdown">Playing in {nextIn}…</p>
              <button
                type="button"
                className="ytp-next-cancel"
                onClick={() => setNextIn(null)}
                aria-label="Cancel autoplay"
                data-player-control
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        )}

        {overlayTop && <div className="ytp-overlay-top">{overlayTop}</div>}

        {statsOpen && (
          <div className="ytp-stats" role="dialog" aria-label="Stats for nerds">
            <div className="ytp-stats-head">
              <Activity className="size-4" />
              <span>Stats for nerds</span>
              <button type="button" onClick={() => setStatsOpen(false)} aria-label="Close stats" data-player-control>
                <X className="size-4" />
              </button>
            </div>
            <dl>
              <div>
                <dt>Resolution</dt>
                <dd>{stats.width && stats.height ? `${stats.width}×${stats.height}` : "—"}</dd>
              </div>
              <div>
                <dt>Dropped frames</dt>
                <dd>
                  {stats.dropped} of {stats.total}
                </dd>
              </div>
              <div>
                <dt>Buffer health</dt>
                <dd>{duration > 0 ? `${formatClock(Math.max(0, bufferedEnd - currentTime))}` : "—"}</dd>
              </div>
              <div>
                <dt>Connection speed</dt>
                <dd>{mediaConnection()}</dd>
              </div>
              <div>
                <dt>Playback rate</dt>
                <dd>{rate}×</dd>
              </div>
              <div>
                <dt>Volume</dt>
                <dd>{muted ? "muted" : `${Math.round(volume * 100)}%`}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd className="ytp-stats-source">{src.split("?")[0]}</dd>
              </div>
            </dl>
          </div>
        )}

        {/* Control bar */}
        <div className="ytp-controls" data-player-control>
          <div
            ref={barRef}
            className="ytp-progress"
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(activeTime)}
            aria-valuetext={`${formatClock(activeTime)} of ${formatClock(duration)}`}
            tabIndex={0}
            onPointerDown={onBarPointerDown}
            onPointerMove={onBarPointerMove}
            onPointerUp={onBarPointerUp}
            onPointerCancel={onBarPointerUp}
            onPointerLeave={() => setHoverTime(null)}
            onKeyDown={event => {
              if (event.key === "ArrowLeft") seekBy(-ARROW_STEP_SECONDS);
              else if (event.key === "ArrowRight") seekBy(ARROW_STEP_SECONDS);
            }}
          >
            <div className="ytp-progress-track">
              <div className="ytp-progress-buffered" style={{ width: `${bufferedPercent}%` }} />
              <div className="ytp-progress-played" style={{ width: `${progressPercent}%` }} />
              {hoverTime !== null && duration > 0 && (
                <div
                  className="ytp-progress-hoverline"
                  style={{ left: `${clamp(hoverTime / duration, 0, 1) * 100}%` }}
                />
              )}
              <span className="ytp-progress-knob" style={{ left: `${progressPercent}%` }} />
            </div>
            {hoverTime !== null && duration > 0 && (
              <span
                className="ytp-progress-tip"
                style={{ left: `${clamp(hoverTime / duration, 0, 1) * 100}%` }}
              >
                {formatClock(hoverTime)}
              </span>
            )}
          </div>

          <div className="ytp-buttons">
            <button type="button" className="ytp-btn" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause /> : <Play />}
            </button>

            {nextIn === null && hasNext && (
              <button type="button" className="ytp-btn" onClick={goNext} aria-label="Next video">
                <SkipForward />
              </button>
            )}

            <div className="ytp-volume">
              <button type="button" className="ytp-btn" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
                <VolumeIcon />
              </button>
              <input
                type="range"
                className="ytp-volume-slider"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={event => applyVolume(Number(event.target.value))}
                aria-label="Volume"
              />
            </div>

            <span className="ytp-time">
              {formatClock(activeTime)}
              <span className="ytp-time-sep"> / </span>
              {formatClock(duration)}
              {duration > 0 && <span className="ytp-time-remaining"> (−{formatClock(remaining)})</span>}
            </span>

            <span className="ytp-spacer" />

            <button
              type="button"
              className={`ytp-btn ${captionsOn ? "is-on" : ""}`}
              onClick={toggleCaptions}
              disabled={!hasCaptions}
              title={hasCaptions ? "Subtitles/CC (c)" : "This video has no caption track published"}
              aria-label="Subtitles/CC"
            >
              <Subtitles />
            </button>

            <div className="ytp-settings-wrap">
              <button
                type="button"
                className="ytp-btn"
                onClick={() => setSettingsOpen(open => (open ? null : "root"))}
                aria-label="Settings"
                aria-expanded={settingsOpen !== null}
              >
                <Settings />
              </button>

              {settingsOpen && (
                <div className="ytp-menu" role="menu">
                  {settingsOpen === "root" && (
                    <>
                      <button
                        type="button"
                        className="ytp-menu-row"
                        onClick={() => setSettingsOpen("speed")}
                        role="menuitem"
                      >
                        <span>Playback speed</span>
                        <span className="ytp-menu-value">
                          {rate === 1 ? "Normal" : `${rate}×`}
                          <ChevronRight className="size-4" />
                        </span>
                      </button>
                      <button
                        type="button"
                        className="ytp-menu-row"
                        onClick={() => setSettingsOpen("quality")}
                        role="menuitem"
                      >
                        <span>Quality</span>
                        <span className="ytp-menu-value">
                          Source
                          <ChevronRight className="size-4" />
                        </span>
                      </button>
                      <button
                        type="button"
                        className="ytp-menu-row"
                        onClick={() => {
                          setSettingsOpen(null);
                          setStatsOpen(true);
                        }}
                        role="menuitem"
                      >
                        <span>Stats for nerds</span>
                        <Activity className="size-4" />
                      </button>
                    </>
                  )}

                  {settingsOpen === "speed" && (
                    <>
                      <button type="button" className="ytp-menu-back" onClick={() => setSettingsOpen("root")} role="menuitem">
                        <ChevronRight className="size-4 ytp-menu-back-icon" />
                        Playback speed
                      </button>
                      {PLAYBACK_RATES.map(value => (
                        <button
                          key={value}
                          type="button"
                          className={`ytp-menu-row ${rate === value ? "is-selected" : ""}`}
                          onClick={() => setRateTo(value)}
                          role="menuitemradio"
                          aria-checked={rate === value}
                        >
                          <span>{value === 1 ? "Normal" : `${value}×`}</span>
                          {rate === value && <Check className="size-4" />}
                        </button>
                      ))}
                    </>
                  )}

                  {settingsOpen === "quality" && (
                    <>
                      <button type="button" className="ytp-menu-back" onClick={() => setSettingsOpen("root")} role="menuitem">
                        <ChevronRight className="size-4 ytp-menu-back-icon" />
                        Quality
                      </button>
                      <p className="ytp-menu-note">
                        HkTube currently publishes one progressive file per video, so there are no
                        separate quality renditions to switch between yet. Encoding a ladder is
                        tracked as integration work.
                      </p>
                      <button type="button" className="ytp-menu-row is-selected" role="menuitemradio" aria-checked="true">
                        <span>Source{stats.width ? ` (${stats.width}×${stats.height})` : ""}</span>
                        <Check className="size-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              className="ytp-btn ytp-btn--desktop"
              onClick={toggleMiniplayer}
              title="Miniplayer (i)"
              aria-label="Miniplayer"
            >
              <PictureInPicture2 />
            </button>

            <button
              type="button"
              className="ytp-btn ytp-btn--desktop"
              onClick={toggleTheater}
              title="Theater mode (t)"
              aria-label="Theater mode"
              aria-pressed={theater}
            >
              <RectangleHorizontal />
            </button>

            <button
              type="button"
              className="ytp-btn"
              onClick={toggleFullscreen}
              title="Full screen (f)"
              aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
            >
              {isFullscreen ? <Minimize /> : <Maximize />}
            </button>
          </div>
        </div>

        {!controlsVisible && playing && !settingsOpen && (
          <div className="ytp-hidden-progress" aria-hidden="true">
            <div style={{ width: `${progressPercent}%` }} />
          </div>
        )}

        <span className="sr-only">{title}</span>
      </div>
    </div>
  );
}

/**
 * Next/previous entry in {@link PLAYBACK_RATES}, used by the `<`/`>` shortcuts.
 * Exported so the shortcut contract can be unit-tested without a DOM.
 */
export function nextRate(current: number, direction: 1 | -1): number {
  const index = PLAYBACK_RATES.indexOf(current as (typeof PLAYBACK_RATES)[number]);
  if (index === -1) return 1;
  const next = clamp(index + direction, 0, PLAYBACK_RATES.length - 1);
  return PLAYBACK_RATES[next];
}

/**
 * Network Information API is Chromium-only and reports a rounded estimate, so
 * this returns a plain "not reported" string rather than inventing a number.
 */
export function mediaConnection(nav: unknown = navigator): string {
  const connection = (nav as { connection?: { downlink?: number; effectiveType?: string } } | undefined)?.connection;
  if (!connection) return "not reported by this browser";
  const parts: string[] = [];
  if (typeof connection.downlink === "number") parts.push(`${connection.downlink} Mbps`);
  if (connection.effectiveType) parts.push(connection.effectiveType);
  return parts.length ? parts.join(" · ") : "not reported by this browser";
}
