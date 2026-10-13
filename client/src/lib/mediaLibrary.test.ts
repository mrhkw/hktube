import { describe, expect, it } from "vitest";
import {
  DEVICE_FOLDER,
  filterMedia,
  folderFromPath,
  formatMediaDuration,
  formatMediaSize,
  groupFolders,
  sortByAdded,
  type MediaEntry,
} from "./mediaLibrary";

function entry(patch: Partial<MediaEntry>): MediaEntry {
  return {
    id: patch.id ?? `id-${Math.random()}`,
    name: patch.name ?? "clip.mp4",
    folder: patch.folder ?? DEVICE_FOLDER,
    kind: patch.kind ?? "video",
    mimeType: patch.mimeType ?? "video/mp4",
    size: patch.size ?? 1024 * 1024,
    durationSeconds: patch.durationSeconds ?? 12,
    width: patch.width ?? 1920,
    height: patch.height ?? 1080,
    thumbnail: patch.thumbnail ?? "",
    addedAt: patch.addedAt ?? 1,
    blob: patch.blob ?? new Blob(["x"], { type: "video/mp4" }),
  };
}

describe("folderFromPath", () => {
  it("keeps the folder tree a folder import reported", () => {
    expect(folderFromPath("DCIM/Camera/IMG_0001.mp4")).toBe("DCIM/Camera");
    expect(folderFromPath("Videos/holiday.mp4")).toBe("Videos");
    expect(folderFromPath("Movies/2026/Aug/clip.mp4")).toBe("Movies/2026/Aug");
  });

  it("falls back to the device label for a loose pick", () => {
    expect(folderFromPath("clip.mp4")).toBe(DEVICE_FOLDER);
    expect(folderFromPath("")).toBe(DEVICE_FOLDER);
    expect(folderFromPath(undefined)).toBe(DEVICE_FOLDER);
    expect(folderFromPath(null)).toBe(DEVICE_FOLDER);
    expect(folderFromPath("///")).toBe(DEVICE_FOLDER);
  });
});

describe("groupFolders", () => {
  it("counts what is really in each folder", () => {
    const groups = groupFolders([
      entry({ folder: "Videos" }),
      entry({ folder: "Videos" }),
      entry({ folder: "DCIM/Camera" }),
    ]);
    expect(groups).toEqual([
      { folder: "DCIM/Camera", count: 1 },
      { folder: "Videos", count: 2 },
    ]);
  });

  it("lists the device folder first, because that is where quick picks land", () => {
    const groups = groupFolders([entry({ folder: "Zebra" }), entry({ folder: DEVICE_FOLDER })]);
    expect(groups[0].folder).toBe(DEVICE_FOLDER);
  });

  it("returns nothing for an empty library instead of a fake folder", () => {
    expect(groupFolders([])).toEqual([]);
  });
});

describe("filterMedia", () => {
  const rows = [
    entry({ id: "a", folder: "Videos", kind: "video", addedAt: 1 }),
    entry({ id: "b", folder: "DCIM/Camera", kind: "image", addedAt: 5 }),
    entry({ id: "c", folder: "Videos", kind: "image", addedAt: 3 }),
  ];

  it("shows newest first", () => {
    expect(filterMedia(rows, {}).map(row => row.id)).toEqual(["b", "c", "a"]);
  });

  it("filters by folder", () => {
    expect(filterMedia(rows, { folder: "Videos" }).map(row => row.id)).toEqual(["c", "a"]);
  });

  it("filters by kind", () => {
    expect(filterMedia(rows, { kind: "image" }).map(row => row.id)).toEqual(["b", "c"]);
    expect(filterMedia(rows, { kind: "video" }).map(row => row.id)).toEqual(["a"]);
  });

  it("combines folder and kind", () => {
    expect(filterMedia(rows, { folder: "Videos", kind: "image" }).map(row => row.id)).toEqual(["c"]);
  });
});

describe("sortByAdded", () => {
  it("does not mutate the caller's array", () => {
    const rows = [entry({ id: "a", addedAt: 1 }), entry({ id: "b", addedAt: 2 })];
    sortByAdded(rows);
    expect(rows.map(row => row.id)).toEqual(["a", "b"]);
  });
});

describe("formatMediaDuration", () => {
  it("reads like a player badge", () => {
    expect(formatMediaDuration(7)).toBe("0:07");
    expect(formatMediaDuration(65)).toBe("1:05");
    expect(formatMediaDuration(723)).toBe("12:03");
  });

  it("stays silent when the duration is unknown", () => {
    expect(formatMediaDuration(0)).toBe("");
    expect(formatMediaDuration(-4)).toBe("");
    expect(formatMediaDuration(Number.NaN)).toBe("");
  });
});

describe("formatMediaSize", () => {
  it("switches units the way a file manager does", () => {
    expect(formatMediaSize(900 * 1024)).toBe("900 KB");
    expect(formatMediaSize(3.5 * 1024 * 1024)).toBe("3.5 MB");
    expect(formatMediaSize(48 * 1024 * 1024)).toBe("48 MB");
  });

  it("never prints a zero-byte lie for a real file", () => {
    expect(formatMediaSize(512)).toBe("1 KB");
  });
});
