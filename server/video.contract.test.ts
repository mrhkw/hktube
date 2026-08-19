import { describe, expect, it } from "vitest";
import { appRouter, videoInputSchema } from "./routers";
import type { TrpcContext } from "./_core/context";

const baseVideo = {
  title: "Authorized media",
  description: "A real video record submitted by an administrator.",
  videoUrl: "/manus-storage/hktube/videos/1/authorized-video.mp4",
  durationSeconds: 75,
  category: "regular" as const,
};

function contextFor(role: "user" | "admin" | null): TrpcContext {
  return {
    user: role ? {
      id: 7,
      openId: "test-user",
      name: "Test account",
      email: "test@example.com",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } : null,
    req: { headers: {}, protocol: "https" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("HKTUBE video contract", () => {
  it("accepts secure stored paths and direct media URLs", () => {
    expect(videoInputSchema.parse(baseVideo).videoUrl).toBe(baseVideo.videoUrl);
    expect(videoInputSchema.parse({ ...baseVideo, videoUrl: "https://media.example.com/authorized.mp4" }).videoUrl).toContain("media.example.com");
  });

  it("rejects a non-storage relative URL", () => {
    expect(() => videoInputSchema.parse({ ...baseVideo, videoUrl: "/untrusted-video.mp4" })).toThrow("stored media path");
  });

  it("does not let a viewer create a video record", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.videos.create(baseVideo)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not let an anonymous visitor delete a video record", async () => {
    const caller = appRouter.createCaller(contextFor(null));
    await expect(caller.videos.remove({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
