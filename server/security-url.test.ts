import { describe, expect, it } from "vitest";
import { videoInputSchema } from "./routers";

describe("security: user-controlled media URLs", () => {
  const base = {
    title: "Security test",
    videoUrl: "https://cdn.example.com/video.mp4",
    durationSeconds: 1,
    category: "regular" as const,
  };

  it("rejects javascript/data/file URL schemes", () => {
    for (const value of [
      "javascript:alert(document.domain)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
    ]) {
      expect(() => videoInputSchema.parse({ ...base, videoUrl: value })).toThrow();
    }
  });

  it("accepts HTTP(S) media and the legacy HkTube storage namespace", () => {
    expect(videoInputSchema.parse(base).videoUrl).toBe(base.videoUrl);
    expect(videoInputSchema.parse({ ...base, videoUrl: "/manus-storage/hktube/videos/demo.mp4" }).videoUrl)
      .toBe("/manus-storage/hktube/videos/demo.mp4");
  });
});
