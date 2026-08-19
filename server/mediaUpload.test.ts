import { describe, expect, it } from "vitest";
import { allowedContentType, maxBytesForKind } from "./mediaUpload";

describe("HKTUBE media upload validation", () => {
  it("accepts only approved direct-playback media types", () => {
    expect(allowedContentType("video", "video/mp4")).toBe(true);
    expect(allowedContentType("video", "video/webm; charset=binary")).toBe(true);
    expect(allowedContentType("thumbnail", "image/webp")).toBe(true);
    expect(allowedContentType("caption", "text/vtt")).toBe(true);
  });

  it("rejects mismatched or potentially unsafe declared media types", () => {
    expect(allowedContentType("video", "application/octet-stream")).toBe(false);
    expect(allowedContentType("thumbnail", "image/svg+xml")).toBe(false);
    expect(allowedContentType("caption", "text/plain")).toBe(false);
  });

  it("keeps non-video uploads at intentionally lower size limits", () => {
    expect(maxBytesForKind("video")).toBeGreaterThan(maxBytesForKind("thumbnail"));
    expect(maxBytesForKind("thumbnail")).toBeGreaterThan(maxBytesForKind("caption"));
  });
});
