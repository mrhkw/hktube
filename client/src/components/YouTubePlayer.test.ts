import { describe, expect, it } from "vitest";
import { formatClock, mediaConnection, nextRate } from "./YouTubePlayer";

/**
 * The player's decision logic is exported as pure functions so the contracts the
 * UI depends on — clock formatting, the `<`/`>` speed ladder, and honest
 * connection reporting — are covered without mounting a `<video>`.
 */
describe("formatClock", () => {
  it("formats seconds and minutes the way the control bar shows them", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(9)).toBe("0:09");
    expect(formatClock(59)).toBe("0:59");
    expect(formatClock(60)).toBe("1:00");
    expect(formatClock(83)).toBe("1:23");
    expect(formatClock(599)).toBe("9:59");
  });

  it("switches to hours once the duration passes one", () => {
    expect(formatClock(3600)).toBe("1:00:00");
    expect(formatClock(3723)).toBe("1:02:03");
    expect(formatClock(36000)).toBe("10:00:00");
  });

  it("truncates fractional seconds instead of rounding up", () => {
    // Rounding would show 0:60 for the last frame of a minute.
    expect(formatClock(59.9)).toBe("0:59");
    expect(formatClock(3599.99)).toBe("59:59");
  });

  it("never renders NaN, Infinity or negatives into the control bar", () => {
    // An unloaded <video> reports NaN duration; the bar must still read 0:00.
    expect(formatClock(Number.NaN)).toBe("0:00");
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe("0:00");
    expect(formatClock(-5)).toBe("0:00");
  });
});

describe("nextRate", () => {
  it("steps through the speed ladder used by the shift+./shift+, shortcuts", () => {
    expect(nextRate(1, 1)).toBe(1.25);
    expect(nextRate(1, -1)).toBe(0.75);
    expect(nextRate(0.5, 1)).toBe(0.75);
    expect(nextRate(1.75, 1)).toBe(2);
  });

  it("clamps at both ends instead of running off the ladder", () => {
    expect(nextRate(0.25, -1)).toBe(0.25);
    expect(nextRate(2, 1)).toBe(2);
  });

  it("recovers to normal speed when the current rate is not a ladder step", () => {
    // A rate restored from storage could be anything; 1x is the safe answer.
    expect(nextRate(1.1, 1)).toBe(1);
    expect(nextRate(Number.NaN, -1)).toBe(1);
  });
});

describe("mediaConnection", () => {
  it("reports nothing rather than inventing a speed on browsers without the API", () => {
    // Firefox and Safari do not implement Network Information.
    expect(mediaConnection({})).toBe("not reported by this browser");
    expect(mediaConnection(undefined)).toBe("not reported by this browser");
    expect(mediaConnection({ connection: {} })).toBe("not reported by this browser");
  });

  it("surfaces the real downlink and effective type when the browser reports them", () => {
    expect(mediaConnection({ connection: { downlink: 9.6, effectiveType: "4g" } })).toBe("9.6 Mbps · 4g");
    expect(mediaConnection({ connection: { effectiveType: "3g" } })).toBe("3g");
    expect(mediaConnection({ connection: { downlink: 1.5 } })).toBe("1.5 Mbps");
  });

  it("keeps a real 0 Mbps reading instead of treating it as missing", () => {
    // A stalled connection legitimately reports 0; that is data, not absence.
    expect(mediaConnection({ connection: { downlink: 0 } })).toBe("0 Mbps");
  });
});
