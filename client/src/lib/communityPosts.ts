/**
 * Community posts (the "+ → Post" flow).
 *
 * The timeline reads Supabase's `posts` table, so posts are written there rather
 * than through the older server composer. Supabase is the single source of truth
 * the app can read back, which matters for a feature whose whole point is that
 * the post shows up.
 *
 * The table's exact columns cannot be introspected at build time, so the module
 * reads its schema from PostgREST at runtime and writes only the columns that
 * exist. Anything the database cannot store is reported to the creator instead of
 * being silently dropped.
 */

import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

/** Posts keep their images in the same bucket the timeline already reads. */
export const POST_BUCKET = "thumbnails";
export const MAX_POST_IMAGES = 10;
export const POST_IMAGE_MAX_BYTES = 12 * 1024 * 1024;
const POST_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

/** Migration that adds the columns this module can use when they exist. */
export const POSTS_MIGRATION = "supabase/migrations/20261013090000_community_posts_multi_image_schedule.sql";

export type PostVisibility = "public" | "unlisted" | "private";

export type CommunityPostInput = {
  body: string;
  imagePaths: string[];
  visibility: PostVisibility;
  /** ISO timestamp, or null to publish straight away. */
  scheduledFor: string | null;
  /** ISO timestamp, or null when the post never expires. */
  expiresAt: string | null;
};

/** Author columns seen across the app's tables; the first that exists wins. */
export const POST_AUTHOR_COLUMNS = ["author_id", "creator_id", "user_id"] as const;

/* ------------------------------------------------------------ pure helpers */

/**
 * PostgREST names the offending column when it rejects an unknown field, in
 * several possible wordings. Returns the column name, or null.
 */
export function isMissingColumnError(message: string): string | null {
  const text = (message ?? "").toString();
  const patterns = [
    /Could not find the '([a-z0-9_]+)' column/i,
    /column\s+[\w.]*?[\"]?([a-z0-9_]+)[\"]?\s+of relation\s+"?[a-z0-9_]+"?\s+does not exist/i,
    // Postgres sometimes qualifies the column with its table: posts.expires_at
    /column\s+(?:[a-z0-9_]+\.)?["']?([a-z0-9_]+)["']?\s+does not exist/i,
    /'([a-z0-9_]+)'\s+column\s+of\s+'[a-z0-9_]+'/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].toLowerCase();
  }
  return null;
}

/** Chooses the author column this database actually has. */
export function pickAuthorColumn(columns: Iterable<string>): string | null {
  const available = new Set([...columns].map(name => name.toLowerCase()));
  for (const candidate of POST_AUTHOR_COLUMNS) {
    if (available.has(candidate)) return candidate;
  }
  return null;
}

/** An ISO string, or null when the value is empty or unparseable. */
export function normalizeIsoOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

/** True when the timestamp is in the future relative to `now`. */
export function isFuture(value: string | null, now = Date.now()): boolean {
  const iso = normalizeIsoOrNull(value);
  if (!iso) return false;
  return new Date(iso).getTime() > now;
}

export type PostLifecycle = "immediate" | "scheduled" | "expired";

/** Decides how a post should be written based on its schedule and expiry. */
export function postLifecycle(input: CommunityPostInput, now = Date.now()): PostLifecycle {
  const expires = normalizeIsoOrNull(input.expiresAt);
  if (expires && new Date(expires).getTime() <= now) return "expired";
  if (isFuture(input.scheduledFor, now)) return "scheduled";
  return "immediate";
}

/**
 * Builds the row to insert, using only columns the table has. `notes` explains
 * anything the database could not store so the caller can say it out loud.
 */
export function buildPostRow(input: {
  authorColumn: string;
  authorId: string;
  post: CommunityPostInput;
  columns: ReadonlySet<string>;
  now?: number;
}): { row: Record<string, unknown>; notes: string[] } {
  const now = input.now ?? Date.now();
  const has = (column: string) => input.columns.has(column.toLowerCase());
  const notes: string[] = [];
  const lifecycle = postLifecycle(input.post, now);

  const row: Record<string, unknown> = {
    [input.authorColumn]: input.authorId,
    content: input.post.body,
    visibility: input.post.visibility,
    status: lifecycle === "scheduled" ? "scheduled" : "published",
  };

  const images = input.post.imagePaths.filter(Boolean);
  if (images.length > 0) {
    if (has("media_paths")) {
      row.media_paths = images;
    } else if (has("media_path")) {
      row.media_path = images[0];
      if (images.length > 1) {
        notes.push(
          `This database stores one image per post, so only the first of your ${images.length} images is saved. Apply ${POSTS_MIGRATION} to keep all of them.`
        );
      }
    } else {
      notes.push("This database has no image column for posts, so the post is published as text only.");
    }
  }

  if (has("published_at") && lifecycle === "immediate") {
    row.published_at = new Date(now).toISOString();
  }
  if (input.post.visibility === "unlisted" || input.post.visibility === "private") {
    notes.push(
      input.post.visibility === "unlisted"
        ? "Unlisted posts are only reachable by link; the posts feed shows public posts."
        : "Private posts are visible to you only."
    );
  }

  return { row, notes };
}

/** The times a post carries, once recorded. */
export function describePostTiming(input: CommunityPostInput, now = Date.now()): string {
  const lifecycle = postLifecycle(input, now);
  const scheduled = normalizeIsoOrNull(input.scheduledFor);
  const expires = normalizeIsoOrNull(input.expiresAt);
  const parts: string[] = [];
  if (lifecycle === "scheduled" && scheduled) {
    parts.push(`Publishes ${new Date(scheduled).toLocaleString()}`);
  } else if (lifecycle === "expired") {
    parts.push("Expiry time has passed");
  } else {
    parts.push("Publishes now");
  }
  if (expires) parts.push(`Expires ${new Date(expires).toLocaleString()}`);
  return parts.join(" · ");
}

/* --------------------------------------------------------------- data access */

const columnCache = new Map<string, Set<string>>();

/**
 * Reads a table's column list from PostgREST's OpenAPI document. Cached for the
 * life of the page; a failure is cached too, so a blocked request does not retry
 * on every keystroke.
 */
export async function fetchTableColumns(table: string): Promise<Set<string>> {
  const cached = columnCache.get(table);
  if (cached) return cached;

  let columns = new Set<string>();
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/rest/v1/`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        Accept: "application/openapi+json",
      },
    });
    if (response.ok) {
      const spec = (await response.json()) as {
        definitions?: Record<string, { properties?: Record<string, unknown> }>;
      };
      const definition = spec.definitions?.[table];
      if (definition?.properties) columns = new Set(Object.keys(definition.properties).map(name => name.toLowerCase()));
    }
  } catch {
    // Discovery is best effort; the insert reports what the database refuses.
  }

  columnCache.set(table, columns);
  return columns;
}

/** Forgets the cached schema, used after a migration is applied. */
export function resetTableColumnCache() {
  columnCache.clear();
}

export type PostImageUpload = {
  paths: string[];
  failed: Array<{ name: string; reason: string }>;
};

/** Validates a picked file before anything is uploaded. */
export function validatePostImage(file: File): string | null {
  if (!POST_IMAGE_TYPES.includes((file.type || "").toLowerCase())) {
    return "Only JPG, PNG, WebP, AVIF or GIF images can be attached.";
  }
  if (!file.size || file.size > POST_IMAGE_MAX_BYTES) {
    return "Images must be 12 MB or smaller.";
  }
  return null;
}

/** Uploads the picked images and returns their storage paths, in pick order. */
export async function uploadPostImages(
  files: readonly File[],
  userId: string,
  onProgress?: (done: number, total: number) => void
): Promise<PostImageUpload> {
  const paths: string[] = [];
  const failed: Array<{ name: string; reason: string }> = [];
  const limited = files.slice(0, MAX_POST_IMAGES);
  if (files.length > MAX_POST_IMAGES) {
    failed.push({
      name: `${files.length - MAX_POST_IMAGES} extra image(s)`,
      reason: `A post can carry up to ${MAX_POST_IMAGES} images.`,
    });
  }

  for (let index = 0; index < limited.length; index += 1) {
    const file = limited[index];
    const problem = validatePostImage(file);
    if (problem) {
      failed.push({ name: file.name, reason: problem });
      onProgress?.(index + 1, limited.length);
      continue;
    }
    const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `posts/${userId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(POST_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "31536000",
    });
    if (error) {
      failed.push({ name: file.name, reason: error.message });
    } else {
      paths.push(path);
    }
    onProgress?.(index + 1, limited.length);
  }

  return { paths, failed };
}

export type InsertPostResult = {
  id: string | null;
  /** Things the database could not store, in plain language. */
  notes: string[];
};

/**
 * Writes the post. If the database rejects a column (for example because the
 * multi-image migration has not been applied), that column is dropped and the
 * insert is retried, with every drop recorded in `notes`.
 */
export async function insertCommunityPost(
  input: CommunityPostInput,
  options: { authorId: string; onRetryColumn?: (column: string) => void } = { authorId: "" }
): Promise<InsertPostResult> {
  const columns = new Set(await fetchTableColumns("posts"));
  const authorColumn = pickAuthorColumn(columns) ?? "author_id";
  const built = buildPostRow({
    authorColumn,
    authorId: options.authorId,
    post: input,
    columns: columns.size > 0 ? columns : new Set([authorColumn, "content", "visibility", "status"]),
  });

  const row = { ...built.row };
  const notes = [...built.notes];

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await supabase.from("posts").insert(row).select("id").limit(1);
    if (!error) {
      const created = (data ?? [])[0] as { id?: string | number } | undefined;
      return { id: created?.id !== undefined ? String(created.id) : null, notes };
    }

    const missing = isMissingColumnError(error.message);
    if (missing && missing in row) {
      delete row[missing];
      // A schedule or expiry that cannot be stored has to be said out loud.
      if (missing === "media_paths" && input.imagePaths.length > 0) {
        if (columns.has("media_path")) {
          row.media_path = input.imagePaths[0];
          notes.push(
            `Only the first of your ${input.imagePaths.length} images could be saved. Apply ${POSTS_MIGRATION} to keep the whole set.`
          );
        } else {
          notes.push("The post is published as text only; this database cannot store post images.");
        }
      } else if (missing === "scheduled_at") {
        notes.push(`Scheduling needs the scheduled_at column. Apply ${POSTS_MIGRATION}.`);
      } else if (missing === "expires_at") {
        notes.push(`Expiration needs the expires_at column. Apply ${POSTS_MIGRATION}.`);
      }
      options.onRetryColumn?.(missing);
      continue;
    }
    throw new Error(error.message);
  }

  throw new Error("The post could not be saved: this database rejected too many fields.");
}

/**
 * Brings scheduled and expired posts up to date.
 *
 * HkTube has no server worker for posts, so this runs when the app is open: due
 * posts publish and expired posts turn private. Videos already have a worker; this
 * is the post equivalent, and it is honest about being client driven.
 */
export async function runPostMaintenance(
  authorId: string,
  now = Date.now()
): Promise<{ published: number; expired: number }> {
  const columns = await fetchTableColumns("posts");
  const result = { published: 0, expired: 0 };
  if (columns.size === 0) return result;

  const authorColumn = pickAuthorColumn(columns) ?? "author_id";
  const isoNow = new Date(now).toISOString();

  if (columns.has("scheduled_at")) {
    const update: Record<string, unknown> = { status: "published" };
    if (columns.has("published_at")) update.published_at = isoNow;
    const { data, error } = await supabase
      .from("posts")
      .update(update)
      .eq("status", "scheduled")
      .eq(authorColumn, authorId)
      .lte("scheduled_at", isoNow)
      .select("id");
    if (!error) result.published = (data ?? []).length;
  }

  if (columns.has("expires_at")) {
    const { data, error } = await supabase
      .from("posts")
      .update({ visibility: "private" })
      .eq("status", "published")
      .eq(authorColumn, authorId)
      .lte("expires_at", isoNow)
      .neq("visibility", "private")
      .select("id");
    if (!error) result.expired = (data ?? []).length;
  }

  return result;
}

/** Public URL for a stored post image path. */
export function postImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return supabase.storage.from(POST_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Turns one stored post row into the paths the carousel renders. */
export function postImagePaths(row: {
  media_paths?: unknown;
  media_path?: unknown;
  media_url?: unknown;
}): string[] {
  const list: string[] = [];
  const multi = row.media_paths;
  if (Array.isArray(multi)) {
    for (const entry of multi) if (typeof entry === "string" && entry) list.push(entry);
  } else if (typeof multi === "string" && multi.trim()) {
    try {
      const parsed = JSON.parse(multi);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) if (typeof entry === "string" && entry) list.push(entry);
      } else {
        list.push(multi);
      }
    } catch {
      list.push(multi);
    }
  }
  if (list.length === 0 && typeof row.media_path === "string" && row.media_path) list.push(row.media_path);
  if (list.length === 0 && typeof row.media_url === "string" && row.media_url) list.push(row.media_url);
  return list;
}
