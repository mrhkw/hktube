import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createVideo, getRelatedVideos, getVideoById, getVideoEngagement, incrementVideoView, listAdminVideos, listVideos, removeVideo, toggleVideoLike } from "./db";

const videoCategory = z.enum(["regular", "shorts"]);
const mediaUrl = z.string().trim().refine(value => {
  if (value.startsWith("/manus-storage/")) return true;
  try {
    return Boolean(new URL(value));
  } catch {
    return false;
  }
}, "Provide a valid external URL or stored media path.");
export const videoInputSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).optional().default(""),
  videoUrl: mediaUrl,
  videoStorageKey: z.string().trim().max(512).optional(),
  thumbnailUrl: mediaUrl.optional(),
  thumbnailStorageKey: z.string().trim().max(512).optional(),
  captionUrl: mediaUrl.optional(),
  captionStorageKey: z.string().trim().max(512).optional(),
  durationSeconds: z.number().int().min(0).max(86_400).default(0),
  category: videoCategory.default("regular"),
});

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  videos: router({
    latest: publicProcedure.input(z.object({ limit: z.number().int().min(1).max(60).optional() }).optional()).query(({ input }) =>
      listVideos({ mode: "latest", limit: input?.limit }),
    ),
    shorts: publicProcedure.input(z.object({ limit: z.number().int().min(1).max(60).optional() }).optional()).query(({ input }) =>
      listVideos({ category: "shorts", mode: "latest", limit: input?.limit }),
    ),
    trending: publicProcedure.input(z.object({ limit: z.number().int().min(1).max(60).optional() }).optional()).query(({ input }) =>
      listVideos({ mode: "trending", limit: input?.limit }),
    ),
    search: publicProcedure.input(z.object({ query: z.string().trim().max(120), limit: z.number().int().min(1).max(60).optional() })).query(({ input }) =>
      input.query ? listVideos({ search: input.query, mode: "latest", limit: input.limit }) : [],
    ),
    byId: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => getVideoById(input.id)),
    related: publicProcedure.input(z.object({ id: z.number().int().positive(), category: videoCategory })).query(({ input }) =>
      getRelatedVideos(input.id, input.category),
    ),
    recordView: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => incrementVideoView(input.id)),
    engagement: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(({ ctx, input }) => getVideoEngagement(input.id, ctx.user?.id)),
    toggleLike: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => toggleVideoLike(input.id, ctx.user.id)),
    create: adminProcedure.input(videoInputSchema).mutation(({ ctx, input }) =>
      createVideo({ ...input, description: input.description || null, thumbnailUrl: input.thumbnailUrl ?? null, thumbnailStorageKey: input.thumbnailStorageKey ?? null, captionUrl: input.captionUrl ?? null, captionStorageKey: input.captionStorageKey ?? null, videoStorageKey: input.videoStorageKey ?? null, uploadedById: ctx.user.id }),
    ),
    adminList: adminProcedure.query(() => listAdminVideos()),
    remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => removeVideo(input.id)),
  }),
});

export type AppRouter = typeof appRouter;
