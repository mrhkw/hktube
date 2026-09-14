import { supabase } from "./supabase";

export type SupabaseVideo = { id: string; creatorId: string; channelId: string; title: string; description: string | null; videoUrl: string; thumbnailUrl: string | null; durationSeconds: number; viewCount: number; publishedAt: string | null; createdAt: string; tags: string[]; moderationStatus?: string | null; status?: string | null };
function publicUrl(bucket: string, path: string | null) { if (!path) return null; if (/^https?:\/\//i.test(path)) return path; return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl; }
function mapVideo(row: any): SupabaseVideo { return { id: String(row.id), creatorId: String(row.creator_id), channelId: String(row.channel_id), title: String(row.title ?? "Untitled video"), description: row.description ?? null, videoUrl: publicUrl("videos", row.video_path) ?? "", thumbnailUrl: publicUrl("thumbnails", row.thumbnail_path), durationSeconds: Number(row.duration_seconds ?? 0), viewCount: Number(row.views ?? 0), publishedAt: row.published_at ?? null, createdAt: row.created_at ?? new Date().toISOString(), tags: Array.isArray(row.tags) ? row.tags.map(String) : [], moderationStatus: row.moderation_status ?? null, status: row.status ?? null }; }
async function requireUser() { const { data, error } = await supabase.auth.getUser(); if (error || !data.user) throw new Error("Your session expired. Please sign in again."); return data.user; }
export async function listMySupabaseVideos(userId: string) { const { data, error } = await supabase.from("videos").select("id,creator_id,channel_id,title,description,video_path,thumbnail_path,duration_seconds,views,published_at,created_at,tags,status,moderation_status").eq("creator_id", userId).order("created_at", { ascending: false }).limit(100); if (error) throw new Error(error.message); return (data ?? []).map(mapVideo); }
export async function listPublicSupabaseVideos(limit = 20) { const { data, error } = await supabase.from("videos").select("id,creator_id,channel_id,title,description,video_path,thumbnail_path,duration_seconds,views,published_at,created_at,tags,status,moderation_status").eq("visibility", "public").eq("status", "published").eq("moderation_status", "approved").order("published_at", { ascending: false }).limit(limit); if (error) throw new Error(error.message); return (data ?? []).map(mapVideo); }
export async function listPublicSupabaseShorts(limit = 40) { const { data, error } = await supabase.from("videos").select("id,creator_id,channel_id,title,description,video_path,thumbnail_path,duration_seconds,views,published_at,created_at,tags,status,moderation_status").eq("visibility", "public").eq("status", "published").eq("moderation_status", "approved").contains("tags", ["shorts"]).order("published_at", { ascending: false }).limit(limit); if (error) throw new Error(error.message); return (data ?? []).map(mapVideo); }
export async function createSupabaseVideo(input: { channelId: string; title: string; description: string; file: File; thumbnail?: File | null; isShort?: boolean; onProgress?: (value: number) => void }) {
  const user = await requireUser();
  if (input.file.size > 900 * 1024 * 1024) throw new Error("Video file must be 900 MB or smaller.");
  if (!input.file.type.startsWith("video/")) throw new Error("Please choose a video file.");
  const probe = document.createElement("video");
  if (!probe.canPlayType(input.file.type)) throw new Error("This video format is not supported by your browser. Please choose an MP4/H.264 video so HkTube can display both picture and sound.");
  if (input.thumbnail && input.thumbnail.size > 12 * 1024 * 1024) throw new Error("Thumbnail must be 12 MB or smaller.");
  const extension = input.file.name.split(".").pop()?.toLowerCase() || "mp4";
  const videoPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
  input.onProgress?.(10);
  const { error: uploadError } = await supabase.storage.from("videos").upload(videoPath, input.file, { contentType: input.file.type, upsert: false, cacheControl: "31536000" });
  if (uploadError) throw new Error(uploadError.message);
  input.onProgress?.(65);
  let thumbnailPath: string | null = null;
  if (input.thumbnail) { const thumbExt = input.thumbnail.name.split(".").pop()?.toLowerCase() || "jpg"; thumbnailPath = `${user.id}/${crypto.randomUUID()}.${thumbExt}`; const { error } = await supabase.storage.from("thumbnails").upload(thumbnailPath, input.thumbnail, { contentType: input.thumbnail.type, upsert: false, cacheControl: "31536000" }); if (error) throw new Error(error.message); }
  input.onProgress?.(82);
  const tags = input.isShort ? ["shorts"] : [];
  const { data, error } = await supabase.from("videos").insert({ creator_id: user.id, channel_id: input.channelId, title: input.title.trim(), description: input.description.trim() || null, tags, visibility: "public", status: "published", moderation_status: "approved", video_path: videoPath, thumbnail_path: thumbnailPath, duration_seconds: 0, allow_comments: true, allow_download: false, made_for_kids: false, views: 0, likes_count: 0, published_at: new Date().toISOString() }).select("id,creator_id,channel_id,title,description,video_path,thumbnail_path,duration_seconds,views,published_at,created_at,tags,status,moderation_status").single();
  if (error) throw new Error(error.message);
  input.onProgress?.(100);
  return mapVideo(data);
}
export { mapVideo };
