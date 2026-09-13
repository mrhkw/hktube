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
  publishedAt: string | null;
  createdAt: string;
};

function publicUrl(bucket: string, path: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function mapVideo(row: any): SupabaseVideo {
  return {
    id: String(row.id),
    creatorId: String(row.creator_id),
    channelId: String(row.channel_id),
    title: String(row.title ?? "Untitled video"),
    description: row.description ?? null,
    videoUrl: publicUrl("videos", row.video_path) ?? "",
    thumbnailUrl: publicUrl("thumbnails", row.thumbnail_path),
    durationSeconds: Number(row.duration_seconds ?? 0),
    viewCount: Number(row.views ?? 0),
    publishedAt: row.published_at ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

export async function listMySupabaseVideos(userId: string) {
  const { data, error } = await supabase.from("videos").select("id,creator_id,channel_id,title,description,video_path,thumbnail_path,duration_seconds,views,published_at,created_at").eq("creator_id", userId).order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapVideo);
}

export async function listPublicSupabaseVideos(limit = 20) {
  const { data, error } = await supabase.from("videos").select("id,creator_id,channel_id,title,description,video_path,thumbnail_path,duration_seconds,views,published_at,created_at").eq("visibility", "public").eq("status", "published").eq("moderation_status", "approved").order("published_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapVideo);
}
