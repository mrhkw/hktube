/**
 * Sound library.
 *
 * HkTube has no licensed music catalogue and no `sounds` table, so the library is
 * built from sounds that really exist on the platform: the audio of published
 * videos, exactly the source the Clips "Use this sound" handoff already uses.
 * Nothing here pretends to be a commercial catalogue.
 */

import { supabase } from "@/lib/supabase";

export type PlatformSound = {
  id: string;
  /** Sound name, normally the source video's title. */
  title: string;
  channelName: string;
  channelHandle: string | null;
  /** Media URL the exporter will mix in. */
  audioUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  /** True when the source is a vertical Clip. */
  isShort: boolean;
};

/** How many sounds the sheet asks for in one page. */
export const SOUND_PAGE_SIZE = 40;

/* ------------------------------------------------------------ pure helpers */

/** "Sound title · Channel" — the line under a sound's artwork. */
export function soundLabel(sound: Pick<PlatformSound, "title" | "channelName">): string {
  const title = sound.title.trim() || "Original sound";
  const channel = sound.channelName.trim();
  return channel ? `${title} · ${channel}` : title;
}

/** Search input is normalised so "@Name", "  name " and "NAME" all match. */
export function normalizeSoundQuery(query: string): string {
  // Trim first: a search pasted as " @name " still has to match.
  return query.trim().replace(/^@+/, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Filters the library by sound title or channel. Results keep the incoming
 * order (already ranked by popularity by the caller).
 */
export function filterSounds(
  sounds: readonly PlatformSound[],
  query: string,
  limit = SOUND_PAGE_SIZE
): PlatformSound[] {
  const needle = normalizeSoundQuery(query);
  const matched = needle
    ? sounds.filter(sound => {
        const haystack = `${sound.title} ${sound.channelName} ${sound.channelHandle ?? ""}`.toLowerCase();
        return haystack.includes(needle);
      })
    : [...sounds];

  const seen = new Set<string>();
  const unique: PlatformSound[] = [];
  for (const sound of matched) {
    // The same audio can appear on several videos; one row per sound source.
    const key = sound.audioUrl || sound.id;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(sound);
    if (unique.length >= limit) break;
  }
  return unique;
}

/** Maps a videos row (plus its channel, when known) into a library entry. */
export function soundFromRow(
  row: {
    id?: string | number;
    title?: string | null;
    thumbnail_path?: string | null;
    duration_seconds?: number | null;
    tags?: unknown;
    is_short?: boolean | null;
  },
  channel: { name?: string | null; handle?: string | null } | null,
  audioUrl: string
): PlatformSound {
  const tags = Array.isArray(row.tags) ? row.tags.map(String) : [];
  return {
    id: String(row.id ?? audioUrl),
    title: (row.title ?? "").toString().trim() || "Original sound",
    channelName: (channel?.name ?? "").toString().trim() || "HkTube Creator",
    channelHandle: channel?.handle ? String(channel.handle) : null,
    audioUrl,
    thumbnailUrl: row.thumbnail_path
      ? row.thumbnail_path.startsWith("http")
        ? row.thumbnail_path
        : supabase.storage.from("thumbnails").getPublicUrl(row.thumbnail_path).data.publicUrl
      : null,
    durationSeconds: Number(row.duration_seconds ?? 0) || 0,
    isShort: Boolean(row.is_short) || tags.includes("shorts"),
  };
}

/* --------------------------------------------------------------- data access */

function publicVideoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return supabase.storage.from("videos").getPublicUrl(path).data.publicUrl;
}

/**
 * Loads sounds from published HkTube videos, most viewed first, with an optional
 * server-side search so a long library still searches fast.
 */
export async function listPlatformSounds(options: { query?: string; limit?: number } = {}): Promise<PlatformSound[]> {
  const limit = Math.min(200, Math.max(1, options.limit ?? SOUND_PAGE_SIZE));
  const query = (options.query ?? "").trim();

  let request = supabase
    .from("videos")
    .select("id,title,thumbnail_path,duration_seconds,video_path,tags,is_short,channel_id")
    .eq("visibility", "public")
    .eq("status", "published")
    .order("views", { ascending: false })
    .limit(limit);
  if (query) request = request.ilike("title", `%${query}%`);

  const { data, error } = await request;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    id: string | number;
    title: string | null;
    thumbnail_path: string | null;
    duration_seconds: number | null;
    video_path: string | null;
    tags: unknown;
    is_short: boolean | null;
    channel_id: string | number | null;
  }>;

  const channelIds = [...new Set(rows.map(row => row.channel_id).filter(Boolean).map(String))];
  const channels = new Map<string, { name: string | null; handle: string | null }>();
  if (channelIds.length > 0) {
    const { data: channelRows } = await supabase
      .from("channels")
      .select("id,name,handle")
      .in("id", channelIds);
    for (const channel of (channelRows ?? []) as Array<{ id: string | number; name: string | null; handle: string | null }>) {
      channels.set(String(channel.id), { name: channel.name, handle: channel.handle });
    }
  }

  return rows
    .map(row => {
      const audioUrl = publicVideoUrl(row.video_path);
      if (!audioUrl) return null;
      const channel = row.channel_id ? channels.get(String(row.channel_id)) ?? null : null;
      return soundFromRow(row, channel, audioUrl);
    })
    .filter((sound): sound is PlatformSound => sound !== null);
}

export type LoadedSound = {
  /** Object URL for the exporter and the preview player. */
  url: string;
  /** True when the bytes were copied locally, which the exporter prefers. */
  local: boolean;
};

/**
 * Copies a sound locally before it is used.
 *
 * The export mixes audio through Web Audio, and a cross-origin media element
 * without a local copy can be tainted into silence, so the bytes are fetched
 * first. If the fetch is blocked the direct URL is returned and the caller warns
 * the creator instead of silently producing a mute video.
 */
export async function loadSoundAsBlob(sound: PlatformSound): Promise<LoadedSound> {
  try {
    const response = await fetch(sound.audioUrl, { mode: "cors" });
    if (response.ok) {
      const blob = await response.blob();
      if (blob.size > 0) return { url: URL.createObjectURL(blob), local: true };
    }
  } catch {
    // Fall through to the direct URL.
  }
  return { url: sound.audioUrl, local: false };
}
