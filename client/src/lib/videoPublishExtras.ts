/**
 * The parts of the Add details page that go beyond what the upload API already
 * accepts: location, AI disclosure, age restriction, paid promotion and the
 * Shorts remix policy, plus adding the finished video to a playlist.
 *
 * Supabase is asked which of those columns exist before they are written, so an
 * un-migrated database reports what it could not store instead of silently
 * dropping the creator's choices.
 */

import { fetchTableColumns } from "@/lib/communityPosts";
import { supabase } from "@/lib/supabase";
import type { RemixOption } from "@/lib/publishOptions";

export type VideoExtras = {
  location: string;
  aiGenerated: boolean;
  ageRestricted: boolean;
  paidPromotion: boolean;
  brandName: string;
  remix: RemixOption;
};

/** Column names this feature would like to write. */
export const VIDEO_EXTRA_COLUMNS = [
  "location",
  "ai_generated",
  "age_restricted",
  "paid_promotion",
  "brand_name",
  "remix_policy",
] as const;

/** Migration that adds the extra columns. */
export const VIDEOS_MIGRATION =
  "supabase/migrations/20261013090000_community_posts_multi_image_schedule.sql";

/**
 * Builds the update payload from the columns that exist. Anything skipped is
 * named in `missing` so the caller can tell the creator.
 */
export function extrasRow(
  extras: VideoExtras,
  columns: ReadonlySet<string>
): { row: Record<string, unknown>; missing: string[] } {
  const row: Record<string, unknown> = {};
  const missing: string[] = [];
  const put = (column: string, value: unknown) => {
    if (columns.has(column)) row[column] = value;
    else missing.push(column);
  };

  const location = extras.location.trim();
  if (location) put("location", location);
  if (extras.aiGenerated) put("ai_generated", true);
  if (extras.ageRestricted) put("age_restricted", true);
  if (extras.paidPromotion) {
    put("paid_promotion", true);
    put("brand_name", extras.brandName.trim() || null);
  }
  // "Allow video and audio remixing" is the default, so only a restriction needs
  // storing.
  if (extras.remix !== "video_and_audio") put("remix_policy", extras.remix);

  return { row, missing };
}

/** True when there is anything at all to write. */
export function hasExtras(extras: VideoExtras): boolean {
  return Boolean(
    extras.location.trim() ||
      extras.aiGenerated ||
      extras.ageRestricted ||
      extras.paidPromotion ||
      extras.remix !== "video_and_audio"
  );
}

/** Stores the extra details on a published video. Returns notes for the UI. */
export async function saveVideoExtras(videoId: string, extras: VideoExtras): Promise<string[]> {
  if (!hasExtras(extras)) return [];
  const columns = await fetchTableColumns("videos");
  if (columns.size === 0) {
    return [
      `The extra details could not be saved because the videos table could not be read. Apply ${VIDEOS_MIGRATION}.`,
    ];
  }
  const { row, missing } = extrasRow(extras, columns);
  if (Object.keys(row).length === 0) {
    return missing.length > 0
      ? [`These details need the ${missing.join(", ")} column(s). Apply ${VIDEOS_MIGRATION}.`]
      : [];
  }
  const { error } = await supabase.from("videos").update(row).eq("id", videoId);
  if (error) return [`The extra details could not be saved: ${error.message}`];
  return missing.length > 0
    ? [`Some details need the ${missing.join(", ")} column(s). Apply ${VIDEOS_MIGRATION}.`]
    : [];
}

/**
 * Adds a freshly published video to the chosen playlist.
 *
 * `position` is only sent when the table has that column, so this works against
 * the live schema as it is.
 */
export async function addVideoToPlaylist(playlistId: string, videoId: string): Promise<string | null> {
  const columns = await fetchTableColumns("playlist_items");
  const row: Record<string, unknown> = { playlist_id: playlistId, video_id: videoId };
  if (columns.has("position")) {
    const { count } = await supabase
      .from("playlist_items")
      .select("id", { count: "exact", head: true })
      .eq("playlist_id", playlistId);
    row.position = count ?? 0;
  }
  const { error } = await supabase.from("playlist_items").insert(row);
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return null;
    return `The video could not be added to the playlist: ${error.message}`;
  }
  return null;
}
