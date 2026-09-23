import { supabase } from "./supabase";

export type SupabaseVideo = {
  id: string;
  creatorId: string;
  channelId: string;
  title: string;
  description: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  viewCount: number;
  likesCount: number;
  publishedAt: string | null;
  createdAt: string;
  tags: string[];
  category: string | null;
  language: string | null;
  isShort: boolean;
  moderationStatus?: string | null;
  status?: string | null;
};

function publicUrl(bucket: string, path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export const VIDEO_SELECT =
  "id,user_id,title,description,video_url,thumbnail_url,duration,views_count,likes_count,created_at,status,visibility,is_short";

function mapVideo(row: Record<string, unknown>): SupabaseVideo {
  return {
    id: String(row.id),
    creatorId: String(row.creator_id ?? row.user_id ?? ""),
    channelId: String(row.channel_id ?? row.user_id ?? ""),
    title: String(row.title ?? "Untitled video"),
    description: typeof row.description === "string" ? row.description : null,
    videoUrl:
      typeof row.video_url === "string"
        ? row.video_url
        : publicUrl("videos", typeof row.video_path === "string" ? row.video_path : null) ?? "",
    thumbnailUrl: publicUrl(
      "thumbnails",
      typeof row.thumbnail_url === "string"
        ? row.thumbnail_url
        : typeof row.thumbnail_path === "string"
          ? row.thumbnail_path
          : null,
    ) ?? (typeof row.thumbnail_url === "string" ? row.thumbnail_url : null),
    durationSeconds: Number(row.duration ?? row.duration_seconds ?? 0),
    viewCount: Number(row.views_count ?? row.views ?? 0),
    likesCount: Number(row.likes_count ?? row.likes ?? 0),
    publishedAt:
      typeof row.published_at === "string"
        ? row.published_at
        : typeof row.created_at === "string"
          ? row.created_at
          : null,
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : new Date().toISOString(),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    category: typeof row.category === "string" ? row.category : null,
    language: typeof row.language === "string" ? row.language : null,
    isShort: Boolean(row.is_short) || (Array.isArray(row.tags) && row.tags.map(String).includes("shorts")),
    moderationStatus:
      typeof row.moderation_status === "string" ? row.moderation_status : null,
    status: typeof row.status === "string" ? row.status : null,
  };
}

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Your session expired. Please sign in again.");
  }
  return data.user;
}

async function readDuration(file: File): Promise<number> {
  return new Promise<number>((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    const timeout = window.setTimeout(() => { cleanup(); resolve(0); }, 12_000);

    const cleanup = () => { window.clearTimeout(timeout); URL.revokeObjectURL(url); };
    video.onloadedmetadata = () => {
      const value = Number.isFinite(video.duration)
        ? Math.max(0, Math.floor(video.duration))
        : 0;
      cleanup();
      resolve(value);
    };
    video.onerror = () => {
      cleanup();
      resolve(0);
    };
    video.src = url;
  });
}

async function readDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    const timeout = window.setTimeout(() => { cleanup(); resolve(null); }, 12_000);

    const cleanup = () => { window.clearTimeout(timeout); URL.revokeObjectURL(url); };
    video.onloadedmetadata = () => {
      const result =
        video.videoWidth > 0 && video.videoHeight > 0
          ? { width: video.videoWidth, height: video.videoHeight }
          : null;
      cleanup();
      resolve(result);
    };
    video.onerror = () => {
      cleanup();
      resolve(null);
    };
    video.src = url;
  });
}

export async function listMySupabaseVideos(userId: string) {
  const { data, error } = await supabase
    .from("videos")
    .select(VIDEO_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapVideo(row as Record<string, unknown>));
}

export async function listPublicSupabaseVideos(limit = 20) {
  const { data, error } = await supabase
    .from("videos")
    .select(VIDEO_SELECT)
    .eq("visibility", "public")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapVideo(row as Record<string, unknown>));
}

export async function listPublicSupabaseShorts(limit = 40) {
  const { data, error } = await supabase
    .from("videos")
    .select(VIDEO_SELECT)
    .eq("visibility", "public")
    .eq("status", "published")
    .eq("is_short", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapVideo(row as Record<string, unknown>));
}

export async function createSupabaseVideo(input: {
  channelId: string;
  title: string;
  description: string;
  file: File;
  thumbnail?: File | null;
  isShort?: boolean;
  durationSeconds?: number;
  category?: string | null;
  language?: string | null;
  visibility?: "public" | "unlisted" | "private";
  allowComments?: boolean;
  madeForKids?: boolean;
  tags?: string[];
  onProgress?: (value: number) => void;
}) {
  const user = await requireUser();

  if (input.file.size > 900 * 1024 * 1024) {
    throw new Error("Video file must be 900 MB or smaller.");
  }
  if (input.file.size <= 0) {
    throw new Error("The selected video is empty.");
  }
  const contentType = input.file.type.toLowerCase().split(";", 1)[0];
  if (contentType !== "video/mp4" && contentType !== "video/webm") {
    throw new Error(
      "For reliable HkTube playback, please choose an MP4/H.264 or WebM video.",
    );
  }

  const probe = document.createElement("video");
  if (!probe.canPlayType(contentType)) {
    throw new Error(
      "This browser cannot play MP4 video. Please use a modern browser.",
    );
  }

  const dimensions = await readDimensions(input.file);
  if (!dimensions) {
    throw new Error(
      "HkTube could not read the video stream. Re-export it as a standard MP4/H.264 file and try again.",
    );
  }

  const isShort = Boolean(input.isShort);
  const cleanTitle = input.title.trim();
  if (!cleanTitle) throw new Error("Video title is required.");
  if (cleanTitle.length > 180) throw new Error("Video title must be 180 characters or fewer.");
  if (isShort) {
    const ratio = dimensions.width / Math.max(dimensions.height, 1);
    if (ratio > 0.8) {
      throw new Error("Clips must be vertical (9:16). Please select a portrait video.");
    }
  } else {
    const ratio = dimensions.width / Math.max(dimensions.height, 1);
    if (ratio < 1.25 || ratio > 2.2) {
      throw new Error("Long videos must use a landscape aspect ratio.");
    }
  }

  if (isShort && Number(input.durationSeconds ?? 0) > 180) {
    throw new Error("Clips cannot exceed 180 seconds.");
  }
  if (input.thumbnail && input.thumbnail.size > 12 * 1024 * 1024) {
    throw new Error("Thumbnail must be 12 MB or smaller.");
  }

  const extension = contentType === "video/webm" ? "webm" : "mp4";
  const videoPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const suppliedDuration = Math.floor(Number(input.durationSeconds ?? 0));
  const duration =
    suppliedDuration > 0 ? suppliedDuration : await readDuration(input.file);

  input.onProgress?.(10);

  const { error: uploadError } = await supabase.storage
    .from("videos")
    .upload(videoPath, input.file, {
      contentType,
      upsert: false,
      cacheControl: "31536000",
    });

  if (uploadError) throw new Error(uploadError.message);
  input.onProgress?.(65);

  let thumbnailPath: string | null = null;

  try {
    if (input.thumbnail) {
      const thumbExt =
        input.thumbnail.name.split(".").pop()?.toLowerCase() || "jpg";
      thumbnailPath = `${user.id}/${crypto.randomUUID()}.${thumbExt}`;

      const { error } = await supabase.storage
        .from("thumbnails")
        .upload(thumbnailPath, input.thumbnail, {
          contentType: input.thumbnail.type || "image/jpeg",
          upsert: false,
          cacheControl: "31536000",
        });

      if (error) throw new Error(error.message);
    }

    input.onProgress?.(82);

    const videoPublicUrl = supabase.storage.from("videos").getPublicUrl(videoPath).data.publicUrl;
    const thumbnailPublicUrl = thumbnailPath
      ? supabase.storage.from("thumbnails").getPublicUrl(thumbnailPath).data.publicUrl
      : null;

    const { data, error } = await supabase
      .from("videos")
      .insert({
        user_id: user.id,
        title: cleanTitle,
        description: input.description.trim() || null,
        video_url: videoPublicUrl,
        thumbnail_url: thumbnailPublicUrl,
        duration,
        views_count: 0,
        likes_count: 0,
        visibility: input.visibility || "public",
        status: "published",
        is_short: isShort,
      })
      .select(VIDEO_SELECT)
      .single();

    if (error) throw new Error(error.message);

    await supabase
      .from("upload_jobs")
      .insert({
        user_id: user.id,
        content_type: isShort ? "short" : "video",
        content_id: data.id,
        file_name: input.file.name,
        storage_path: videoPath,
        bytes_total: input.file.size,
        bytes_uploaded: input.file.size,
        status: "completed",
      })
      .then(() => undefined, () => undefined);

    input.onProgress?.(100);
    return mapVideo(data as Record<string, unknown>);
  } catch (error) {
    await supabase.storage.from("videos").remove([videoPath]).catch(() => undefined);
    if (thumbnailPath) {
      await supabase.storage.from("thumbnails").remove([thumbnailPath]).catch(() => undefined);
    }
    throw error;
  }
}

export { mapVideo };
