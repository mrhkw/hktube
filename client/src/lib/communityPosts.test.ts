import { describe, expect, it } from "vitest";
import {
  buildPostRow,
  describePostTiming,
  isFuture,
  isMissingColumnError,
  MAX_POST_IMAGES,
  normalizeIsoOrNull,
  pickAuthorColumn,
  postImagePaths,
  postLifecycle,
  validatePostImage,
  type CommunityPostInput,
} from "./communityPosts";

const NOW = new Date("2026-10-13T09:00:00.000Z").getTime();

function post(patch: Partial<CommunityPostInput> = {}): CommunityPostInput {
  return {
    body: "Hello HkTube",
    imagePaths: [],
    visibility: "public",
    scheduledFor: null,
    expiresAt: null,
    ...patch,
  };
}

const fullColumns = new Set([
  "id",
  "author_id",
  "content",
  "media_path",
  "media_paths",
  "visibility",
  "status",
  "scheduled_at",
  "expires_at",
  "published_at",
]);

describe("isMissingColumnError", () => {
  it("reads the column out of PostgREST's schema cache error", () => {
    expect(
      isMissingColumnError("Could not find the 'media_paths' column of 'posts' in the schema cache")
    ).toBe("media_paths");
  });

  it("reads the column out of Postgres' own wording", () => {
    expect(isMissingColumnError('column "scheduled_at" of relation "posts" does not exist')).toBe("scheduled_at");
    expect(isMissingColumnError("column posts.expires_at does not exist")).toBe("expires_at");
  });

  it("stays silent for unrelated failures, so nothing is dropped by accident", () => {
    expect(isMissingColumnError("new row violates row-level security policy")).toBeNull();
    expect(isMissingColumnError("")).toBeNull();
  });
});

describe("pickAuthorColumn", () => {
  it("uses the column this database actually has", () => {
    expect(pickAuthorColumn(["id", "content", "author_id"])).toBe("author_id");
    expect(pickAuthorColumn(["id", "creator_id"])).toBe("creator_id");
    expect(pickAuthorColumn(["user_id", "content"])).toBe("user_id");
  });

  it("has no answer when the table has none of them", () => {
    expect(pickAuthorColumn(["id", "content"])).toBeNull();
  });
});

describe("time helpers", () => {
  it("keeps a real timestamp and drops junk", () => {
    expect(normalizeIsoOrNull("2026-10-14T10:00:00Z")).toBe("2026-10-14T10:00:00.000Z");
    expect(normalizeIsoOrNull("not a date")).toBeNull();
    expect(normalizeIsoOrNull(null)).toBeNull();
    expect(normalizeIsoOrNull("")).toBeNull();
  });

  it("knows what is still ahead", () => {
    expect(isFuture("2026-10-14T10:00:00Z", NOW)).toBe(true);
    expect(isFuture("2026-10-12T10:00:00Z", NOW)).toBe(false);
    expect(isFuture(null, NOW)).toBe(false);
  });

  it("classifies a post as immediate, scheduled or expired", () => {
    expect(postLifecycle(post(), NOW)).toBe("immediate");
    expect(postLifecycle(post({ scheduledFor: "2026-10-14T10:00:00Z" }), NOW)).toBe("scheduled");
    expect(postLifecycle(post({ expiresAt: "2026-10-12T10:00:00Z" }), NOW)).toBe("expired");
  });

  it("describes the timing in words", () => {
    expect(describePostTiming(post(), NOW)).toContain("Publishes now");
    expect(describePostTiming(post({ scheduledFor: "2026-10-14T10:00:00Z" }), NOW)).toContain("Publishes ");
    expect(describePostTiming(post({ expiresAt: "2026-10-20T10:00:00Z" }), NOW)).toContain("Expires ");
  });
});

describe("buildPostRow", () => {
  it("writes the row the table can hold", () => {
    const { row, notes } = buildPostRow({
      authorColumn: "author_id",
      authorId: "user-1",
      post: post({ body: "Hi", imagePaths: ["a.jpg", "b.jpg"] }),
      columns: fullColumns,
      now: NOW,
    });
    expect(row.author_id).toBe("user-1");
    expect(row.content).toBe("Hi");
    expect(row.status).toBe("published");
    expect(row.media_paths).toEqual(["a.jpg", "b.jpg"]);
    expect(row.published_at).toBe(new Date(NOW).toISOString());
    expect(notes).toEqual([]);
  });

  it("marks a scheduled post as scheduled and does not stamp a publish time", () => {
    const { row } = buildPostRow({
      authorColumn: "author_id",
      authorId: "user-1",
      post: post({ scheduledFor: "2026-10-14T10:00:00Z" }),
      columns: fullColumns,
      now: NOW,
    });
    expect(row.status).toBe("scheduled");
    expect(row.published_at).toBeUndefined();
  });

  it("falls back to one image and says so when media_paths is missing", () => {
    const columns = new Set([...fullColumns].filter(name => name !== "media_paths"));
    const { row, notes } = buildPostRow({
      authorColumn: "author_id",
      authorId: "user-1",
      post: post({ imagePaths: ["a.jpg", "b.jpg", "c.jpg"] }),
      columns,
      now: NOW,
    });
    expect(row.media_path).toBe("a.jpg");
    expect(row.media_paths).toBeUndefined();
    expect(notes.join(" ")).toContain("only the first");
  });

  it("keeps the single image quiet when there is only one", () => {
    const columns = new Set([...fullColumns].filter(name => name !== "media_paths"));
    const { notes } = buildPostRow({
      authorColumn: "author_id",
      authorId: "user-1",
      post: post({ imagePaths: ["a.jpg"] }),
      columns,
      now: NOW,
    });
    expect(notes).toEqual([]);
  });

  it("never claims images were stored when the table has no image column", () => {
    const columns = new Set(["id", "author_id", "content", "visibility", "status"]);
    const { row, notes } = buildPostRow({
      authorColumn: "author_id",
      authorId: "user-1",
      post: post({ imagePaths: ["a.jpg"] }),
      columns,
      now: NOW,
    });
    expect(row.media_path).toBeUndefined();
    expect(notes.join(" ")).toContain("text only");
  });

  it("explains that unlisted and private posts leave the public feed", () => {
    const unlisted = buildPostRow({
      authorColumn: "author_id",
      authorId: "user-1",
      post: post({ visibility: "unlisted" }),
      columns: fullColumns,
      now: NOW,
    });
    const privatePost = buildPostRow({
      authorColumn: "author_id",
      authorId: "user-1",
      post: post({ visibility: "private" }),
      columns: fullColumns,
      now: NOW,
    });
    expect(unlisted.notes.join(" ")).toContain("Unlisted");
    expect(privatePost.notes.join(" ")).toContain("Private");
  });
});

describe("postImagePaths", () => {
  it("reads the carousel list", () => {
    expect(postImagePaths({ media_paths: ["a.jpg", "b.jpg"] })).toEqual(["a.jpg", "b.jpg"]);
  });

  it("reads a JSON string, which is how jsonb sometimes arrives", () => {
    expect(postImagePaths({ media_paths: '["a.jpg","b.jpg"]' })).toEqual(["a.jpg", "b.jpg"]);
  });

  it("falls back to the single image column", () => {
    expect(postImagePaths({ media_paths: [], media_path: "single.jpg" })).toEqual(["single.jpg"]);
  });

  it("returns nothing for a text-only post rather than a broken image", () => {
    expect(postImagePaths({})).toEqual([]);
    expect(postImagePaths({ media_paths: null })).toEqual([]);
  });
});

describe("validatePostImage", () => {
  const file = (patch: Partial<File>) => ({ name: "a.jpg", type: "image/jpeg", size: 1024, ...patch }) as File;

  it("accepts a normal photo", () => {
    expect(validatePostImage(file({}))).toBeNull();
  });

  it("refuses anything that is not an image", () => {
    expect(validatePostImage(file({ type: "video/mp4" }))).toContain("JPG");
  });

  it("refuses a file over the bucket limit", () => {
    expect(validatePostImage(file({ size: 13 * 1024 * 1024 }))).toContain("12 MB");
  });
});

describe("post limits", () => {
  it("matches the ten images the composer promises", () => {
    expect(MAX_POST_IMAGES).toBe(10);
  });
});
