/**
 * HkTube creation engine.
 *
 * The editing tools in the Clips composer used to be labels without behaviour.
 * This module makes them real: overlays, filters, trimming, added audio and
 * voiceover are composited onto a canvas and re-encoded with `MediaRecorder`,
 * so what the creator sees in the editor is what gets uploaded.
 *
 * Everything the editor needs to reason about — filter presets, trim clamping,
 * overlay geometry and the honest set of encodable formats — is exported as a
 * pure function so it can be unit-tested without a browser.
 */

/* ------------------------------------------------------------------ filters */

export type FilterId =
  | "none"
  | "vivid"
  | "warm"
  | "cool"
  | "mono"
  | "film"
  | "fade"
  | "dramatic";

export type FilterPreset = {
  id: FilterId;
  label: string;
  /** CSS filter string. The same value drives the preview and the bake. */
  css: string;
};

/**
 * Presets are plain CSS filters so the live preview and the exported frames use
 * one definition and cannot drift.
 */
export const FILTER_PRESETS: readonly FilterPreset[] = [
  { id: "none", label: "Original", css: "none" },
  { id: "vivid", label: "Vivid", css: "saturate(1.45) contrast(1.12) brightness(1.04)" },
  { id: "warm", label: "Warm", css: "sepia(0.28) saturate(1.3) hue-rotate(-8deg) brightness(1.05)" },
  { id: "cool", label: "Cool", css: "saturate(1.12) hue-rotate(12deg) brightness(1.03) contrast(1.05)" },
  { id: "mono", label: "Mono", css: "grayscale(1) contrast(1.15)" },
  { id: "film", label: "Film", css: "sepia(0.18) contrast(1.18) saturate(0.86) brightness(0.98)" },
  { id: "fade", label: "Fade", css: "saturate(0.78) brightness(1.1) contrast(0.92)" },
  { id: "dramatic", label: "Dramatic", css: "contrast(1.42) saturate(1.1) brightness(0.94)" },
] as const;

/** Resolves a preset id to its CSS filter string, falling back to `none`. */
export function filterCss(id: FilterId): string {
  return FILTER_PRESETS.find(preset => preset.id === id)?.css ?? "none";
}

/* ----------------------------------------------------------------- overlays */

export type TextFontId = "classic" | "bold" | "serif" | "typewriter" | "handwriting" | "poster";

export type TextFont = {
  id: TextFontId;
  label: string;
  /** Canvas `font` shorthand family, matching the CSS family used in preview. */
  family: string;
  weight: number;
};

export const TEXT_FONTS: readonly TextFont[] = [
  { id: "classic", label: "Classic", family: "system-ui, -apple-system, Segoe UI, sans-serif", weight: 600 },
  { id: "bold", label: "Bold", family: "system-ui, -apple-system, Segoe UI, sans-serif", weight: 900 },
  { id: "serif", label: "Serif", family: "Georgia, 'Times New Roman', serif", weight: 700 },
  { id: "typewriter", label: "Mono", family: "ui-monospace, 'SF Mono', Menlo, monospace", weight: 600 },
  { id: "handwriting", label: "Script", family: "'Segoe Script', 'Bradley Hand', cursive", weight: 600 },
  { id: "poster", label: "Poster", family: "Impact, 'Arial Black', sans-serif", weight: 900 },
] as const;

export function textFont(id: TextFontId): TextFont {
  return TEXT_FONTS.find(font => font.id === id) ?? TEXT_FONTS[0];
}

/** A text layer placed over the video. `x`/`y` are 0..1 fractions of the frame. */
export type TextOverlay = {
  id: string;
  kind: "text";
  text: string;
  fontId: TextFontId;
  color: string;
  /** Font size as a fraction of frame height, so it scales with any resolution. */
  size: number;
  x: number;
  y: number;
  align: "left" | "center" | "right";
};

/** A sticker layer. Emoji are the portable sticker set the platform ships. */
export type StickerOverlay = {
  id: string;
  kind: "sticker";
  emoji: string;
  size: number;
  x: number;
  y: number;
};

export type Overlay = TextOverlay | StickerOverlay;

export const STICKER_SET = [
  "🔥", "😂", "❤️", "✨", "🎉", "😍", "👏", "💯",
  "🎵", "🌟", "😎", "🙌", "💥", "🥳", "🌈", "⚡",
  "🍕", "☕", "🐱", "🌸", "🚀", "👀", "🤯", "💜",
] as const;

export const TEXT_COLORS = [
  "#ffffff", "#000000", "#ff2d55", "#ff9500", "#ffd60a",
  "#34c759", "#00c7be", "#0a84ff", "#af52de", "#ff375f",
] as const;

/** Keeps an overlay inside the frame no matter how far it is dragged. */
export function clampOverlayPosition(x: number, y: number): { x: number; y: number } {
  const safe = (value: number) => (Number.isFinite(value) ? Math.min(0.96, Math.max(0.04, value)) : 0.5);
  return { x: safe(x), y: safe(y) };
}

/** How the source frame is placed on the export canvas. */
export type FrameFit = "cover" | "contain";

/**
 * HkTube accepts landscape long videos between 1.25 and 2.2, and vertical Clips
 * up to 0.8. Anything outside those windows is cropped onto a legal frame at
 * export instead of being rejected after the creator finished editing.
 */
export const LONG_RATIO_MIN = 1.25;
export const LONG_RATIO_MAX = 2.2;

/** The canvas ratio the exporter must produce for this upload. */
export function targetCanvasRatio(sourceRatio: number, vertical: boolean): number {
  if (vertical) return 9 / 16;
  const safe = Number.isFinite(sourceRatio) && sourceRatio > 0 ? sourceRatio : 16 / 9;
  return Math.min(LONG_RATIO_MAX, Math.max(LONG_RATIO_MIN, safe));
}

/** True when the source frame has to be cropped or letterboxed to be accepted. */
export function needsReframe(sourceRatio: number, vertical: boolean): boolean {
  if (!Number.isFinite(sourceRatio) || sourceRatio <= 0) return false;
  const target = targetCanvasRatio(sourceRatio, vertical);
  return Math.abs(target - sourceRatio) > 0.01;
}

/* ------------------------------------------------------------------ effects */

export type EffectId = "vignette" | "glow" | "grain";

export type EffectPreset = {
  id: EffectId;
  label: string;
  hint: string;
};

/**
 * Canvas effects, drawn after the filtered frame. They are painted at export
 * time too, so an effect the creator switches on is really in the file.
 */
export const EFFECT_PRESETS: readonly EffectPreset[] = [
  { id: "vignette", label: "Vignette", hint: "Darkens the frame edges" },
  { id: "glow", label: "Glow", hint: "Soft light bloom over the frame" },
  { id: "grain", label: "Grain", hint: "Fine film grain" },
] as const;

/** Draws the active effects over an already-drawn frame. */
export function drawEffects(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  effects: readonly EffectId[],
  frameIndex = 0
): void {
  for (const effect of effects) {
    if (effect === "vignette") {
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.28,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.72
      );
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.save();
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    } else if (effect === "glow") {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.16;
      const bloom = ctx.createRadialGradient(
        width / 2,
        height * 0.42,
        0,
        width / 2,
        height * 0.42,
        Math.max(width, height) * 0.6
      );
      bloom.addColorStop(0, "rgba(255,255,255,0.9)");
      bloom.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    } else if (effect === "grain") {
      // Cheap deterministic speckle: a changing offset per frame keeps it alive
      // without allocating an ImageData buffer on every frame.
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = "#ffffff";
      const step = Math.max(3, Math.round(Math.min(width, height) / 160));
      for (let y = (frameIndex * 7) % step; y < height; y += step) {
        for (let x = (frameIndex * 13) % step; x < width; x += step) {
          if (((x * 7919 + y * 104729 + frameIndex * 31) >>> 0) % 5 === 0) ctx.fillRect(x, y, 1, 1);
        }
      }
      ctx.restore();
    }
  }
}

/**
 * Draws the manual caption banner across the lower third, matching the preview
 * in `create.css` so what the creator types is what lands in the file.
 */
export function drawCaptionBanner(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  caption: string | undefined
): void {
  const text = (caption ?? "").trim();
  if (!text) return;
  const fontSize = Math.max(14, Math.round(height * 0.036));
  const paddingX = Math.round(fontSize * 0.7);
  const paddingY = Math.round(fontSize * 0.4);
  const maxWidth = width * 0.84;

  ctx.save();
  ctx.font = `700 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = wrapText(ctx, text, maxWidth);
  const lineHeight = fontSize * 1.32;
  const boxHeight = lines.length * lineHeight + paddingY * 2;
  const boxWidth = Math.min(
    maxWidth + paddingX * 2,
    Math.max(...lines.map(line => ctx.measureText(line).width)) + paddingX * 2
  );
  const boxX = (width - boxWidth) / 2;
  const boxY = height * 0.86 - boxHeight / 2;

  ctx.fillStyle = "rgba(0,0,0,0.62)";
  const radius = Math.round(fontSize * 0.55);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, radius);
  } else {
    ctx.rect(boxX, boxY, boxWidth, boxHeight);
  }
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, boxY + paddingY + lineHeight * (index + 0.5));
  });
  ctx.restore();
}

/* --------------------------------------------------------------------- trim */

export type TrimRange = { start: number; end: number };

export const MIN_TRIM_SECONDS = 0.5;

/**
 * Clamps a trim range into the real media duration. Handles unknown durations
 * (a file whose metadata has not loaded reports 0/NaN) by leaving the range
 * alone rather than collapsing it to nothing.
 */
/**
 * Recording-speed bounds. Below 0.3 the encoder cannot keep up with the source
 * elements, and above 3 the picture turns into a slideshow.
 */
export const MIN_SPEED = 0.3;
export const MAX_SPEED = 3;

/** Clamps a requested playback speed, treating junk as normal speed. */
export function clampSpeed(speed: number | undefined): number {
  if (typeof speed !== "number" || !Number.isFinite(speed) || speed <= 0) return 1;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed));
}

export function clampTrim(range: TrimRange, duration: number): TrimRange {
  if (!Number.isFinite(duration) || duration <= 0) {
    const start = Math.max(0, Number.isFinite(range.start) ? range.start : 0);
    const end = Math.max(start + MIN_TRIM_SECONDS, Number.isFinite(range.end) ? range.end : start + MIN_TRIM_SECONDS);
    return { start, end };
  }
  const start = Math.min(Math.max(0, Number.isFinite(range.start) ? range.start : 0), duration);
  let end = Number.isFinite(range.end) ? range.end : duration;
  end = Math.min(Math.max(start + MIN_TRIM_SECONDS, end), duration);
  // A range that cannot hold the minimum means the whole clip is shorter than it.
  if (end - start < MIN_TRIM_SECONDS) {
    const adjusted = Math.max(0, Math.min(start, duration - MIN_TRIM_SECONDS));
    return { start: adjusted, end: Math.min(duration, adjusted + MIN_TRIM_SECONDS) };
  }
  return { start, end };
}

/** `1:05.2` — the trimmer shows tenths so a cut can be placed precisely. */
export function formatTrimTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
}

/** True when the trim already covers the whole clip, so no re-encode is needed. */
export function isFullRange(range: TrimRange, duration: number): boolean {
  if (!Number.isFinite(duration) || duration <= 0) return false;
  return range.start <= 0.05 && range.end >= duration - 0.05;
}

/* ---------------------------------------------------------------- recording */

/** Formats MediaRecorder can actually produce here, best first. */
export const RECORDING_MIME_CANDIDATES = [
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
] as const;

/**
 * Picks the best container the browser can actually encode. MP4 is preferred so
 * the upload satisfies HkTube's H.264/WebM playback contract; WebM is the honest
 * fallback everywhere else.
 */
export function pickRecordingMime(supported: (type: string) => boolean): string | undefined {
  return RECORDING_MIME_CANDIDATES.find(type => supported(type));
}

export function isRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

/** `-1` when the browser cannot tell us how much is left. */
export function recordingEta(elapsedSeconds: number, trimSeconds: number): number {
  if (!Number.isFinite(trimSeconds) || trimSeconds <= 0) return -1;
  return Math.max(0, trimSeconds - elapsedSeconds);
}

/* ------------------------------------------------------------------- audio */

export type AddedAudio = {
  id: string;
  name: string;
  url: string;
  /** Source volume 0..1 for the mixed output. */
  volume: number;
};

export type Voiceover = {
  /** A live stream captured from the microphone during editing. */
  stream?: MediaStream | null;
  volume: number;
};

/**
 * True when the export has to re-encode. Filters, overlays, added audio, a
 * voiceover, or a partial trim all change the pixels or the mix; without any of
 * them the original file is uploaded untouched, which is both faster and
 * lossless.
 */
export function needsReEncode(input: {
  trim: TrimRange;
  duration: number;
  filter: FilterId;
  overlays: Overlay[];
  addedAudio: AddedAudio[];
  hasVoiceover: boolean;
  /** Optional so older callers keep the old behaviour. */
  effects?: readonly EffectId[];
  /** Recording speed; 1 means untouched. */
  speed?: number;
  /** True when text has to be burned into the frames. */
  hasCaption?: boolean;
}): boolean {
  if (input.hasCaption) return true;
  if (input.overlays.length > 0) return true;
  if (input.effects && input.effects.length > 0) return true;
  if (input.speed !== undefined && input.speed !== 1) return true;
  if (input.filter !== "none") return true;
  if (input.addedAudio.length > 0) return true;
  if (input.hasVoiceover) return true;
  return !isFullRange(input.trim, input.duration);
}

/* ---------------------------------------------------------------- geometry */

/**
 * Source rectangle for `drawImage` that reproduces CSS `object-fit: cover` for a
 * canvas of the given size. Without this, a portrait clip drawn into a portrait
 * canvas is fine, but any aspect mismatch stretches the picture.
 */
export function coverRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): { sx: number; sy: number; sw: number; sh: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    return { sx: 0, sy: 0, sw: Math.max(1, sourceWidth), sh: Math.max(1, sourceHeight) };
  }
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  if (sourceRatio > targetRatio) {
    // Source is wider: crop the sides.
    const sw = sourceHeight * targetRatio;
    return { sx: (sourceWidth - sw) / 2, sy: 0, sw, sh: sourceHeight };
  }
  // Source is taller: crop top and bottom.
  const sh = sourceWidth / targetRatio;
  return { sx: 0, sy: (sourceHeight - sh) / 2, sw: sourceWidth, sh };
}

/**
 * Export canvas size. Vertical media keeps a 9:16 canvas, landscape keeps its
 * own aspect ratio, and `maxEdge` caps the longest side so a 4K upload does not
 * exhaust memory during the bake.
 */
export function exportCanvasSize(
  videoWidth: number,
  videoHeight: number,
  options: { vertical: boolean; maxEdge?: number; forceRatio?: number }
): { width: number; height: number } {
  const maxEdge = options.maxEdge ?? 1080;
  const ratio =
    options.forceRatio ??
    (options.vertical ? 9 / 16 : videoWidth / Math.max(videoHeight, 1));
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 9 / 16;

  // Derive from the real source size, then scale the *longest* edge down to the
  // cap. Scaling only the short edge would let a 4K landscape source through at
  // 1920 wide, which is exactly what the cap exists to prevent.
  const sourceWidth = videoWidth > 0 ? videoWidth : safeRatio < 1 ? maxEdge : maxEdge * safeRatio;
  const sourceHeight = videoHeight > 0 ? videoHeight : safeRatio < 1 ? maxEdge / safeRatio : maxEdge;
  const longest = Math.max(sourceWidth, sourceHeight);
  const scale = longest > maxEdge ? maxEdge / longest : 1;

  let width = sourceWidth * scale;
  let height = sourceHeight * scale;
  // An explicit ratio (9:16 for Clips, or a legal landscape window) governs the
  // canvas whatever the source ratio.
  if (typeof options.forceRatio === "number" && options.forceRatio > 0) {
    if (options.forceRatio >= 1) {
      height = Math.min(height, maxEdge);
      width = height * options.forceRatio;
      if (width > maxEdge) {
        width = maxEdge;
        height = width / options.forceRatio;
      }
    } else {
      width = Math.min(width, maxEdge);
      height = width / options.forceRatio;
      if (height > maxEdge) {
        height = maxEdge;
        width = height * options.forceRatio;
      }
    }
    return { width: even(width), height: even(height) };
  }

  // Vertical media is framed to 9:16 whatever the source ratio, matching the
  // editor preview that the creator approved.
  if (options.vertical) {
    width = Math.min(maxEdge, height * (9 / 16));
    height = Math.min(maxEdge, width / (9 / 16));
  }
  return { width: even(width), height: even(height) };
}

/** H.264 encoders reject odd dimensions, so round down to an even number. */
function even(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

/* --------------------------------------------------------------- filenames */

/**
 * Names the exported file so the upload keeps a valid extension. HkTube accepts
 * MP4 and WebM only, so an unexpected container falls back to `.webm` rather
 * than producing a file the server will reject.
 */
export function exportFileName(mimeType: string, stamp = Date.now()): string {
  const extension = mimeType.includes("mp4") ? "mp4" : "webm";
  return `hktube-clip-${stamp}.${extension}`;
}

/* ------------------------------------------------------- render + re-encode */

export type ExportProgress = {
  /** 0..1 of the trimmed range that has been encoded. */
  fraction: number;
  secondsRemaining: number;
};

export type ExportInput = {
  file: File;
  trim: TrimRange;
  filter: FilterId;
  effects: readonly EffectId[];
  /** Manual caption banner text; empty when the creator added none. */
  caption?: string;
  /**
   * Playback speed applied while baking. The recorder captures the canvas in
   * wall-clock time, so playing the source at `speed` really does produce a
   * faster or slower file instead of a decorative setting.
   */
  speed?: number;
  overlays: Overlay[];
  addedAudio: AddedAudio[];
  voiceover?: MediaStream | null;
  vertical: boolean;
  /**
   * Bakes even when nothing else changed. Used when the source frame has to be
   * reshaped to a ratio HkTube accepts, where passing the original through
   * would be rejected at upload time.
   */
  forceReEncode?: boolean;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
};

export type ExportResult = {
  file: File;
  /** True when the original file was passed through because nothing changed. */
  passedThrough: boolean;
};

/**
 * Draws one composited frame. Kept separate from the recorder loop so the exact
 * same drawing is used for the export and for an exported still thumbnail.
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  filter: string,
  overlays: Overlay[],
  effects: readonly EffectId[] = [],
  frameIndex = 0,
  fit: FrameFit = "cover"
): void {
  ctx.save();
  ctx.filter = filter;
  if (fit === "contain") {
    // Letterbox: the whole frame survives, so a landscape clip posted as a Clip
    // is not sliced down to its middle third.
    const scale = Math.min(width / Math.max(video.videoWidth, 1), height / Math.max(video.videoHeight, 1));
    const drawWidth = video.videoWidth * scale;
    const drawHeight = video.videoHeight * scale;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(video, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  } else {
    const rect = coverRect(video.videoWidth, video.videoHeight, width, height);
    ctx.drawImage(video, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, width, height);
  }
  ctx.restore();

  for (const overlay of overlays) {
    const cx = overlay.x * width;
    const cy = overlay.y * height;
    if (overlay.kind === "text") {
      const font = textFont(overlay.fontId);
      const size = Math.max(10, overlay.size * height);
      ctx.save();
      ctx.font = `${font.weight} ${size}px ${font.family}`;
      ctx.textAlign = overlay.align;
      ctx.textBaseline = "middle";
      // A stroke keeps light text readable over a bright frame, the way the
      // editor preview does with its drop shadow.
      ctx.lineWidth = Math.max(2, size * 0.09);
      ctx.strokeStyle = "rgba(0,0,0,0.72)";
      ctx.lineJoin = "round";
      const lines = wrapText(ctx, overlay.text, width * 0.9);
      const lineHeight = size * 1.18;
      const startY = cy - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, index) => {
        ctx.strokeText(line, cx, startY + index * lineHeight);
        ctx.fillStyle = overlay.color;
        ctx.fillText(line, cx, startY + index * lineHeight);
      });
      ctx.restore();
    } else {
      const size = Math.max(12, overlay.size * height);
      ctx.save();
      ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(overlay.emoji, cx, cy);
      ctx.restore();
    }
  }

  if (effects.length > 0) drawEffects(ctx, width, height, effects, frameIndex);
}

/** Greedy word wrap that respects explicit newlines in the creator's text. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length > 0 ? lines : [""];
}

/** Loads a media element and resolves once its metadata is usable. */
function loadMedia<T extends HTMLMediaElement>(element: T, src: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      element.removeEventListener("loadedmetadata", onLoaded);
      element.removeEventListener("error", onError);
    };
    const onLoaded = () => {
      cleanup();
      resolve(element);
    };
    const onError = () => {
      cleanup();
      reject(new Error("The selected media could not be loaded."));
    };
    element.addEventListener("loadedmetadata", onLoaded, { once: true });
    element.addEventListener("error", onError, { once: true });
    element.src = src;
    element.load();
  });
}

/**
 * Composites the clip and re-encodes it in real time.
 *
 * Recording is real time because `MediaRecorder` captures a live canvas: a 30
 * second trim takes about 30 seconds to export. The progress callback therefore
 * reports real remaining seconds rather than a fabricated percentage.
 */
export async function exportEditedVideo(input: ExportInput): Promise<ExportResult> {
  const duration = await mediaDuration(input.file);
  if (
    !needsReEncode({
      trim: input.trim,
      duration,
      filter: input.filter,
      effects: input.effects,
      overlays: input.overlays,
      addedAudio: input.addedAudio,
      hasVoiceover: Boolean(input.voiceover),
      speed: input.speed,
      hasCaption: Boolean(input.caption && input.caption.trim()),
    }) &&
    !input.forceReEncode
  ) {
    input.onProgress?.({ fraction: 1, secondsRemaining: 0 });
    return { file: input.file, passedThrough: true };
  }

  if (!isRecordingSupported()) {
    throw new Error(
      "This browser cannot render edited Clips. Update it, or publish without filters, text and trimming."
    );
  }

  const sourceUrl = URL.createObjectURL(input.file);
  const video = document.createElement("video");
  video.muted = false;
  video.playsInline = true;
  video.preload = "auto";

  const disposables: Array<() => void> = [];
  let audioContext: AudioContext | null = null;

  try {
    await loadMedia(video, sourceUrl);
    const sourceRatio = video.videoWidth / Math.max(video.videoHeight, 1);
    const reframe = needsReframe(sourceRatio, input.vertical);
    // A Clip always lands on 9:16. A long video is squeezed into the landscape
    // window HkTube accepts, cropping only when the source is outside it.
    const targetRatio = targetCanvasRatio(sourceRatio, input.vertical);
    const fit: FrameFit = input.vertical && sourceRatio >= 1 ? "contain" : "cover";
    const { width, height } = exportCanvasSize(video.videoWidth, video.videoHeight, {
      vertical: input.vertical,
      forceRatio: targetRatio,
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("The editor canvas could not be created.");

    const canvasStream = canvas.captureStream(30);
    const output = new MediaStream(canvasStream.getVideoTracks());

    // Audio graph: the source clip, every added track, and the voiceover are
    // mixed through Web Audio so the upload carries one finished soundtrack.
    const wantsAudio =
      input.addedAudio.length > 0 || Boolean(input.voiceover) || videoHasAudio(video);
    const addedElements: HTMLAudioElement[] = [];
    if (wantsAudio) {
      audioContext = new AudioContext();
      await audioContext.resume().catch(() => undefined);
      const destination = audioContext.createMediaStreamDestination();

      if (videoHasAudio(video)) {
        const videoSource = audioContext.createMediaElementSource(video);
        videoSource.connect(destination);
      }

      for (const track of input.addedAudio) {
        const element = new Audio(track.url);
        element.loop = true;
        await loadMedia(element, track.url).catch(() => undefined);
        const source = audioContext.createMediaElementSource(element);
        const gain = audioContext.createGain();
        gain.gain.value = track.volume;
        source.connect(gain).connect(destination);
        addedElements.push(element);
      }

      if (input.voiceover) {
        const micSource = audioContext.createMediaStreamSource(input.voiceover);
        micSource.connect(destination);
      }

      destination.stream.getAudioTracks().forEach(track => output.addTrack(track));
    }

    const mimeType = pickRecordingMime(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error("This browser cannot encode the edited Clip.");

    const recorder = new MediaRecorder(output, { mimeType, videoBitsPerSecond: 6_000_000 });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = event => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const range = clampTrim(input.trim, video.duration);
    const trimSeconds = range.end - range.start;
    const speed = clampSpeed(input.speed);
    // The export lasts as long as the sped-up (or slowed) footage takes to play.
    const outputSeconds = trimSeconds / speed;
    const filterValue = filterCss(input.filter);

    video.currentTime = range.start;

    const stopped = new Promise<void>(resolve => {
      recorder.onstop = () => resolve();
    });

    await new Promise<void>((resolve, reject) => {
      const onSeeked = () => resolve();
      video.addEventListener("seeked", onSeeked, { once: true });
      // Some browsers have already seeked; a cheap guard avoids a stall.
      window.setTimeout(() => resolve(), 400);
    });

    let frameHandle = 0;
    const frameIndexRef = { value: 0 };
    const startedAt = performance.now();

    const pump = () => {
      if (input.signal?.aborted) {
        if (recorder.state !== "inactive") recorder.stop();
        return;
      }
      if (video.ended || video.currentTime >= range.end) {
        if (recorder.state !== "inactive") recorder.stop();
        return;
      }
      drawFrame(
        ctx,
        video,
        width,
        height,
        filterValue,
        input.overlays,
        input.effects,
        frameIndexRef.value,
        fit
      );
      drawCaptionBanner(ctx, width, height, input.caption);
      frameIndexRef.value += 1;
      const elapsed = (performance.now() - startedAt) / 1000;
      input.onProgress?.({
        fraction: Math.min(1, outputSeconds > 0 ? elapsed / outputSeconds : 0),
        secondsRemaining: recordingEta(elapsed, outputSeconds),
      });
      frameHandle = requestAnimationFrame(pump);
    };

    addedElements.forEach(element => void element.play().catch(() => undefined));
    recorder.start(1000);
    // Set before play(): the element refuses some rate changes mid-playback.
    video.playbackRate = speed;
    await video.play().catch(() => undefined);
    frameHandle = requestAnimationFrame(pump);

    disposables.push(() => {
      cancelAnimationFrame(frameHandle);
      video.pause();
      addedElements.forEach(element => element.pause());
      if (recorder.state !== "inactive") recorder.stop();
    });

    await stopped;
    input.onProgress?.({ fraction: 1, secondsRemaining: 0 });

    const blob = new Blob(chunks, { type: mimeType });
    if (blob.size === 0) throw new Error("The edit produced an empty file. Try a shorter trim.");

    return {
      file: new File([blob], exportFileName(mimeType), { type: blob.type }),
      passedThrough: false,
    };
  } finally {
    disposables.forEach(dispose => dispose());
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(sourceUrl);
    audioContext?.close().catch(() => undefined);
  }
}

function videoHasAudio(video: HTMLVideoElement): boolean {
  const extended = video as HTMLVideoElement & {
    mozHasAudio?: boolean;
    webkitAudioDecodedByteCount?: number;
    audioTracks?: { length: number };
  };
  if (typeof extended.mozHasAudio === "boolean") return extended.mozHasAudio;
  if (typeof extended.webkitAudioDecodedByteCount === "number") {
    return extended.webkitAudioDecodedByteCount > 0;
  }
  if (extended.audioTracks) return extended.audioTracks.length > 0;
  // Unknown: assume the clip has sound so the mix is never silently dropped.
  return true;
}

/** Reads the duration of a local file without a lasting object URL. */
export function mediaDuration(file: File): Promise<number> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    const done = (value: number) => {
      video.removeAttribute("src");
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.addEventListener("loadedmetadata", () => done(Number.isFinite(video.duration) ? video.duration : 0), {
      once: true,
    });
    video.addEventListener("error", () => done(0), { once: true });
    video.src = url;
    video.load();
  });
}

/**
 * Grabs a frame of the trimmed clip, with the current filter and overlays
 * applied, as a JPEG the upload can use as the cover.
 */
export async function captureEditedFrame(
  file: File,
  atSeconds: number,
  options: {
    filter: FilterId;
    effects?: readonly EffectId[];
    caption?: string;
    overlays: Overlay[];
    vertical: boolean;
    type?: string;
    quality?: number;
  }
): Promise<File | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  try {
    await loadMedia(video, url);
    const { width, height } = exportCanvasSize(video.videoWidth, video.videoHeight, {
      vertical: options.vertical,
      maxEdge: 1280,
    });
    await new Promise<void>(resolve => {
      video.addEventListener("seeked", () => resolve(), { once: true });
      video.currentTime = Math.max(0, Math.min(atSeconds, Math.max(0, video.duration - 0.1)));
      window.setTimeout(() => resolve(), 600);
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const sourceRatio = video.videoWidth / Math.max(video.videoHeight, 1);
    drawFrame(
      ctx,
      video,
      width,
      height,
      filterCss(options.filter),
      options.overlays,
      options.effects ?? [],
      0,
      options.vertical && sourceRatio >= 1 ? "contain" : "cover"
    );
    drawCaptionBanner(ctx, width, height, options.caption);
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, options.type ?? "image/jpeg", options.quality ?? 0.9)
    );
    if (!blob) return null;
    return new File([blob], `hktube-cover-${Date.now()}.jpg`, { type: blob.type });
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
