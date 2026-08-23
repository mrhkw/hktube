import { describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  createVideo: vi.fn(),
  getRelatedVideos: vi.fn(),
  getVideoById: vi.fn(),
  getVideoEngagement: vi.fn(),
  incrementVideoView: vi.fn(),
  listAdminVideos: vi.fn(),
  listVideos: vi.fn(),
  removeVideo: vi.fn(),
  toggleVideoLike: vi.fn(),
}));

vi.mock("./db", () => repository);

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextFor(role: "user" | "admin" | null): TrpcContext {
  return {
    user: role ? {
      id: 15,
      openId: "router-test-user",
      name: "Router test user",
      email: role === "admin" ? "hanifnazamdin6@gmail.com" : "router@example.com",
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

describe("HKTUBE public video router", () => {
  it("requests the newest catalog records for Home", async () => {
    repository.listVideos.mockResolvedValueOnce([]);
    await appRouter.createCaller(contextFor(null)).videos.latest({ limit: 12 });
    expect(repository.listVideos).toHaveBeenLastCalledWith({ mode: "latest", limit: 12 });
  });

  it("requests Shorts from the shorts category", async () => {
    repository.listVideos.mockResolvedValueOnce([]);
    await appRouter.createCaller(contextFor(null)).videos.shorts({ limit: 8 });
    expect(repository.listVideos).toHaveBeenLastCalledWith({ category: "shorts", mode: "latest", limit: 8 });
  });

  it("requests Trending records in view-count order", async () => {
    repository.listVideos.mockResolvedValueOnce([]);
    await appRouter.createCaller(contextFor(null)).videos.trending({ limit: 6 });
    expect(repository.listVideos).toHaveBeenLastCalledWith({ mode: "trending", limit: 6 });
  });

  it("sends a nonempty search query to the live catalog repository", async () => {
    repository.listVideos.mockResolvedValueOnce([]);
    await appRouter.createCaller(contextFor(null)).videos.search({ query: "science", limit: 18 });
    expect(repository.listVideos).toHaveBeenLastCalledWith({ search: "science", mode: "latest", limit: 18 });
  });

  it("increments the database-backed counter when a watch page records a view", async () => {
    repository.incrementVideoView.mockResolvedValueOnce({ id: 9, viewCount: 3 });
    await appRouter.createCaller(contextFor(null)).videos.recordView({ id: 9 });
    expect(repository.incrementVideoView).toHaveBeenLastCalledWith(9);
  });

  it("returns real engagement with no fabricated viewer state for a visitor", async () => {
    repository.getVideoEngagement.mockResolvedValueOnce({ likeCount: 2, likedByViewer: false });
    const result = await appRouter.createCaller(contextFor(null)).videos.engagement({ id: 9 });
    expect(result).toEqual({ likeCount: 2, likedByViewer: false });
    expect(repository.getVideoEngagement).toHaveBeenLastCalledWith(9, undefined);
  });

  it("allows signed-in viewers to toggle only their own video like", async () => {
    repository.toggleVideoLike.mockResolvedValueOnce({ likeCount: 3, likedByViewer: true });
    const result = await appRouter.createCaller(contextFor("user")).videos.toggleLike({ id: 9 });
    expect(result).toEqual({ likeCount: 3, likedByViewer: true });
    expect(repository.toggleVideoLike).toHaveBeenLastCalledWith(9, 15);
  });

  it("allows the owner role to publish an authorized video record", async () => {
    repository.createVideo.mockResolvedValueOnce({ id: 44 });
    await appRouter.createCaller(contextFor("admin")).videos.create({
      title: "Authorized upload",
      description: "An authentic HKTUBE upload.",
      videoUrl: "/manus-storage/hktube/videos/15/authorized.mp4",
      durationSeconds: 90,
      category: "regular",
    });
    expect(repository.createVideo).toHaveBeenLastCalledWith(expect.objectContaining({
      title: "Authorized upload",
      uploadedById: 15,
      category: "regular",
    }));
  });
});
