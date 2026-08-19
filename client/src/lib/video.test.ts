import { describe, expect, it } from "vitest";
import { formatDuration, formatViews } from "./video";

describe("HKTUBE video formatting", () => {
  it("formats real playback durations without inventing a value", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(75)).toBe("1:15");
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  it("does not display a fabricated view count for a new video", () => {
    expect(formatViews(0)).toBe("No views yet");
  });
});
