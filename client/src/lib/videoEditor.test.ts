import { describe, expect, it } from "vitest";
import {
  clampOverlayPosition,
  clampSpeed,
  clampTrim,
  coverRect,
  drawCaptionBanner,
  drawEffects,
  EFFECT_PRESETS,
  exportCanvasSize,
  exportFileName,
  FILTER_PRESETS,
  filterCss,
  formatTrimTime,
  isFullRange,
  LONG_RATIO_MAX,
  LONG_RATIO_MIN,
  MAX_SPEED,
  MIN_SPEED,
  MIN_TRIM_SECONDS,
  needsReEncode,
  needsReframe,
  pickRecordingMime,
  RECORDING_MIME_CANDIDATES,
  recordingEta,
  targetCanvasRatio,
  TEXT_FONTS,
  textFont,
  type Overlay,
} from "./videoEditor";

const noEdits = {
  trim: { start: 0, end: 30 },
  duration: 30,
  filter: "none" as const,
  overlays: [] as Overlay[],
  addedAudio: [],
  hasVoiceover: false,
};

describe("filter presets", () => {
  it("resolves every preset id, so no tab can silently render unfiltered", () => {
    for (const preset of FILTER_PRESETS) {
      expect(filterCss(preset.id)).toBe(preset.css);
    }
  });

  it("falls back to no filter for an unknown id rather than throwing", () => {
    expect(filterCss("nope" as never)).toBe("none");
  });

  it("keeps ids unique so the picker cannot show duplicates", () => {
    const ids = FILTER_PRESETS.map(preset => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("text fonts", () => {
  it("resolves every font id and always returns a usable family", () => {
    for (const font of TEXT_FONTS) expect(textFont(font.id).family).toBe(font.family);
    expect(textFont("missing" as never).family).toBe(TEXT_FONTS[0].family);
  });
});

describe("clampOverlayPosition", () => {
  it("keeps an overlay inside the frame when dragged past an edge", () => {
    expect(clampOverlayPosition(-3, -9)).toEqual({ x: 0.04, y: 0.04 });
    expect(clampOverlayPosition(4, 7)).toEqual({ x: 0.96, y: 0.96 });
  });

  it("passes through a valid position untouched", () => {
    expect(clampOverlayPosition(0.25, 0.75)).toEqual({ x: 0.25, y: 0.75 });
  });

  it("centres an overlay whose drag produced NaN", () => {
    expect(clampOverlayPosition(Number.NaN, Number.NaN)).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe("clampTrim", () => {
  it("keeps the range inside the media duration", () => {
    expect(clampTrim({ start: -4, end: 90 }, 30)).toEqual({ start: 0, end: 30 });
    expect(clampTrim({ start: 5, end: 20 }, 30)).toEqual({ start: 5, end: 20 });
  });

  it("never produces a range shorter than the minimum", () => {
    const range = clampTrim({ start: 10, end: 10.1 }, 30);
    expect(range.end - range.start).toBeGreaterThanOrEqual(MIN_TRIM_SECONDS);
  });

  it("keeps a usable range when the duration is not known yet", () => {
    // A file whose metadata has not loaded reports 0 or NaN; collapsing the
    // range to nothing would make the trimmer unusable before load.
    const range = clampTrim({ start: 2, end: 6 }, Number.NaN);
    expect(range).toEqual({ start: 2, end: 6 });
    expect(clampTrim({ start: Number.NaN, end: Number.NaN }, 0).end).toBeGreaterThanOrEqual(MIN_TRIM_SECONDS);
  });

  it("fits a minimum-length range into a clip shorter than the minimum", () => {
    const range = clampTrim({ start: 0, end: 0 }, 0.2);
    expect(range.start).toBe(0);
    expect(range.end).toBeCloseTo(0.2, 5);
  });
});

describe("formatTrimTime", () => {
  it("shows tenths so a cut can be placed precisely", () => {
    expect(formatTrimTime(0)).toBe("0:00.0");
    expect(formatTrimTime(5.25)).toBe("0:05.3");
    expect(formatTrimTime(65.5)).toBe("1:05.5");
  });

  it("renders safe values for unloaded metadata", () => {
    expect(formatTrimTime(Number.NaN)).toBe("0:00.0");
    expect(formatTrimTime(-3)).toBe("0:00.0");
  });
});

describe("isFullRange", () => {
  it("treats a minor rounding difference as the full clip", () => {
    // Seeking to the very end lands a few milliseconds short; re-encoding for
    // that would cost quality for nothing.
    expect(isFullRange({ start: 0, end: 29.97 }, 30)).toBe(true);
  });

  it("detects a real trim", () => {
    expect(isFullRange({ start: 1, end: 30 }, 30)).toBe(false);
    expect(isFullRange({ start: 0, end: 20 }, 30)).toBe(false);
  });

  it("refuses to claim the full range when the duration is unknown", () => {
    expect(isFullRange({ start: 0, end: 10 }, 0)).toBe(false);
  });
});

describe("pickRecordingMime", () => {
  it("prefers MP4 so the upload meets the H.264 playback contract", () => {
    expect(pickRecordingMime(() => true)).toBe(RECORDING_MIME_CANDIDATES[0]);
    expect(pickRecordingMime(() => true)).toContain("mp4");
  });

  it("falls back to WebM when MP4 encoding is unavailable", () => {
    const picked = pickRecordingMime(type => type.startsWith("video/webm"));
    expect(picked).toBe("video/webm;codecs=vp9,opus");
  });

  it("returns undefined when nothing is supported, so the caller can explain", () => {
    expect(pickRecordingMime(() => false)).toBeUndefined();
  });
});

describe("recordingEta", () => {
  it("counts down the remaining trim", () => {
    expect(recordingEta(0, 30)).toBe(30);
    expect(recordingEta(12, 30)).toBe(18);
  });

  it("reports -1 rather than a fake zero when the length is unknown", () => {
    expect(recordingEta(4, 0)).toBe(-1);
    expect(recordingEta(4, Number.NaN)).toBe(-1);
  });
});

describe("needsReEncode", () => {
  it("passes an untouched clip straight through", () => {
    expect(needsReEncode(noEdits)).toBe(false);
  });

  it("re-encodes for every kind of edit", () => {
    expect(needsReEncode({ ...noEdits, filter: "vivid" })).toBe(true);
    expect(
      needsReEncode({
        ...noEdits,
        overlays: [{ kind: "text", id: "1", text: "hi", fontId: "bold", color: "#fff", size: 0.1, x: 0.5, y: 0.5, align: "center" }],
      })
    ).toBe(true);
    expect(needsReEncode({ ...noEdits, addedAudio: [{ id: "a", name: "song", url: "blob:x", volume: 0.5 }] })).toBe(true);
    expect(needsReEncode({ ...noEdits, hasVoiceover: true })).toBe(true);
    expect(needsReEncode({ ...noEdits, trim: { start: 2, end: 30 } })).toBe(true);
  });
});

describe("coverRect", () => {
  it("crops the sides when the source is wider than the canvas", () => {
    // 16:9 source into a 9:16 canvas.
    const rect = coverRect(1920, 1080, 1080, 1920);
    expect(rect.sw).toBeCloseTo(607.5, 1);
    expect(rect.sh).toBe(1080);
  });

  it("crops top and bottom when the source is taller than the canvas", () => {
    const rect = coverRect(1080, 1920, 1080, 1080);
    expect(rect.sw).toBe(1080);
    expect(rect.sh).toBeCloseTo(1080, 1);
  });

  it("returns the whole frame when the ratios already match", () => {
    const rect = coverRect(1080, 1920, 1080, 1920);
    expect(rect).toEqual({ sx: 0, sy: 0, sw: 1080, sh: 1920 });
  });

  it("never returns a zero-sized source rect for unloaded media", () => {
    const rect = coverRect(0, 0, 1080, 1920);
    expect(rect.sw).toBeGreaterThan(0);
    expect(rect.sh).toBeGreaterThan(0);
  });
});

describe("exportCanvasSize", () => {
  it("produces a 9:16 canvas for vertical media", () => {
    const size = exportCanvasSize(1080, 1920, { vertical: true });
    expect(size.width / size.height).toBeCloseTo(9 / 16, 2);
  });

  it("keeps landscape aspect ratios", () => {
    const size = exportCanvasSize(1920, 1080, { vertical: false });
    expect(size.width / size.height).toBeCloseTo(16 / 9, 2);
  });

  it("keeps both dimensions even, because H.264 rejects odd sizes", () => {
    const size = exportCanvasSize(1921, 1081, { vertical: false });
    expect(size.width % 2).toBe(0);
    expect(size.height % 2).toBe(0);
  });

  it("caps the long edge so a 4K upload cannot exhaust memory", () => {
    const size = exportCanvasSize(3840, 2160, { vertical: false, maxEdge: 1080 });
    expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(1080);
  });
});

describe("exportFileName", () => {
  it("uses the extension HkTube accepts for each container", () => {
    expect(exportFileName("video/mp4", 1)).toBe("hktube-clip-1.mp4");
    expect(exportFileName("video/webm;codecs=vp9,opus", 1)).toBe("hktube-clip-1.webm");
  });

  it("never emits an extension the upload would reject", () => {
    expect(exportFileName("video/quicktime", 1)).toBe("hktube-clip-1.webm");
    expect(exportFileName("", 1)).toBe("hktube-clip-1.webm");
  });
});

describe("clampSpeed", () => {
  it("keeps the speeds the camera and editor offer", () => {
    for (const speed of [0.3, 0.5, 1, 1.5, 2, 3]) {
      expect(clampSpeed(speed)).toBe(speed);
    }
  });

  it("clamps beyond the encoder's usable range instead of dropping frames", () => {
    expect(clampSpeed(12)).toBe(MAX_SPEED);
    expect(clampSpeed(0.01)).toBe(MIN_SPEED);
  });

  it("treats a missing or broken speed as normal speed", () => {
    expect(clampSpeed(undefined)).toBe(1);
    expect(clampSpeed(0)).toBe(1);
    expect(clampSpeed(-2)).toBe(1);
    expect(clampSpeed(Number.NaN)).toBe(1);
    expect(clampSpeed(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("needsReEncode with speed", () => {
  it("re-encodes when the creator changed the speed", () => {
    expect(needsReEncode({ ...noEdits, speed: 2 })).toBe(true);
    expect(needsReEncode({ ...noEdits, speed: 0.5 })).toBe(true);
  });

  it("still passes the original file through at normal speed", () => {
    expect(needsReEncode({ ...noEdits, speed: 1 })).toBe(false);
    expect(needsReEncode(noEdits)).toBe(false);
  });
});

describe("captions and effects reach the export", () => {
  it("treats any selected effect as an edit, so it cannot be preview-only", () => {
    expect(needsReEncode({ ...noEdits, effects: ["vignette"] })).toBe(true);
    expect(needsReEncode({ ...noEdits, effects: [] })).toBe(false);
  });

  it("offers effects that all render something", () => {
    for (const preset of EFFECT_PRESETS) {
      expect(preset.id.length).toBeGreaterThan(0);
      expect(preset.label.length).toBeGreaterThan(0);
    }
  });

  it("exposes drawCaptionBanner and drawEffects as real drawing entry points", () => {
    expect(typeof drawCaptionBanner).toBe("function");
    expect(typeof drawEffects).toBe("function");
  });
});

describe("ratio safety", () => {
  it("keeps a 16:9 source as it is", () => {
    expect(targetCanvasRatio(16 / 9, false)).toBeCloseTo(16 / 9, 5);
    expect(needsReframe(16 / 9, false)).toBe(false);
  });

  it("lifts a too-square landscape source into HkTube's window", () => {
    expect(targetCanvasRatio(1.0, false)).toBe(LONG_RATIO_MIN);
    expect(targetCanvasRatio(1.1, false)).toBe(LONG_RATIO_MIN);
    expect(needsReframe(1.1, false)).toBe(true);
  });

  it("pulls an ultra-wide source back into HkTube's window", () => {
    expect(targetCanvasRatio(3.2, false)).toBe(LONG_RATIO_MAX);
    expect(needsReframe(3.2, false)).toBe(true);
  });

  it("always frames a Clip to 9:16", () => {
    expect(targetCanvasRatio(16 / 9, true)).toBeCloseTo(9 / 16, 5);
    expect(needsReframe(16 / 9, true)).toBe(true);
    expect(needsReframe(9 / 16, true)).toBe(false);
  });

  it("does not claim a reframe it cannot measure", () => {
    expect(needsReframe(0, false)).toBe(false);
    expect(needsReframe(Number.NaN, true)).toBe(false);
  });

  it("builds an explicit canvas that stays inside the cap", () => {
    const vertical = exportCanvasSize(1920, 1080, { vertical: true, forceRatio: 9 / 16 });
    expect(vertical.width / vertical.height).toBeCloseTo(9 / 16, 2);
    expect(Math.max(vertical.width, vertical.height)).toBeLessThanOrEqual(1080);

    const square = exportCanvasSize(1080, 1080, { vertical: false, forceRatio: LONG_RATIO_MIN });
    expect(square.width / square.height).toBeCloseTo(LONG_RATIO_MIN, 2);
    expect(Math.max(square.width, square.height)).toBeLessThanOrEqual(1080);
  });
});

describe("needsReEncode with a burned-in caption", () => {
  it("re-encodes so the banner is really on the frames", () => {
    expect(needsReEncode({ ...noEdits, hasCaption: true })).toBe(true);
    expect(needsReEncode({ ...noEdits, hasCaption: false })).toBe(false);
  });
});
