/**
 * Local media library for the creation flow.
 *
 * A browser cannot read the phone's gallery or its Videos/DCIM/Camera folders —
 * that needs a native app. What a browser *can* do is keep its own library: the
 * files a creator imports are stored in IndexedDB with their folder path, so the
 * picker shows real folders and a real grid of what was imported, instead of a
 * fake list of system folders that cannot be opened.
 */

export type MediaKind = "video" | "image";

export type MediaEntry = {
  id: string;
  name: string;
  /** Folder path as imported, or the default label for loose picks. */
  folder: string;
  kind: MediaKind;
  mimeType: string;
  size: number;
  durationSeconds: number;
  width: number;
  height: number;
  /** Small JPEG data URL used by the grid. */
  thumbnail: string;
  addedAt: number;
  blob: Blob;
};

export const DEVICE_FOLDER = "Device gallery";

const DB_NAME = "hktube-media-library";
const DB_VERSION = 1;
const STORE = "media";
/** Keeps the library from silently eating the browser's storage quota. */
export const MAX_ENTRIES = 200;

/** True when this environment can persist a library at all. */
export function isLibrarySupported(): boolean {
  return typeof indexedDB !== "undefined";
}

/** True when the browser can import a whole folder tree at once. */
export function isFolderImportSupported(): boolean {
  return typeof document !== "undefined" && "webkitdirectory" in document.createElement("input");
}

/* ------------------------------------------------------------ pure helpers */

/** Directory part of a folder-picker path, e.g. "DCIM/Camera/IMG.jpg" -> "DCIM/Camera". */
export function folderFromPath(relativePath: string | undefined | null): string {
  const value = (relativePath ?? "").trim();
  if (!value) return DEVICE_FOLDER;
  const parts = value.split("/").filter(Boolean);
  if (parts.length <= 1) return DEVICE_FOLDER;
  return parts.slice(0, -1).join("/");
}

/** The chips the picker shows: counts per folder plus a Videos/Photos split. */
export function groupFolders(
  entries: readonly MediaEntry[]
): Array<{ folder: string; count: number }> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.folder, (counts.get(entry.folder) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([folder, count]) => ({ folder, count }))
    .sort((a, b) => (a.folder === DEVICE_FOLDER ? -1 : b.folder === DEVICE_FOLDER ? 1 : a.folder.localeCompare(b.folder)));
}

/** Newest first, so the creator sees what they just imported. */
export function sortByAdded(entries: readonly MediaEntry[]): MediaEntry[] {
  return [...entries].sort((a, b) => b.addedAt - a.addedAt);
}

/** Filters the grid by the selected chip. */
export function filterMedia(
  entries: readonly MediaEntry[],
  filter: { folder?: string; kind?: MediaKind | "all" }
): MediaEntry[] {
  const kind = filter.kind ?? "all";
  return sortByAdded(entries).filter(entry => {
    if (filter.folder && entry.folder !== filter.folder) return false;
    if (kind !== "all" && entry.kind !== kind) return false;
    return true;
  });
}

/** "0:07", "1:05", "12:03" — the badge under each cell. */
export function formatMediaDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/** "18 MB" — shown in the grid so an oversized file is obvious before upload. */
export function formatMediaSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/* ----------------------------------------------------------------- storage */

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("folder", "folder", { unique: false });
        store.createIndex("addedAt", "addedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The media library could not be opened."));
  });
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The media library request failed."));
  });
}

/** Reads the whole library, newest first. */
export async function listMedia(): Promise<MediaEntry[]> {
  if (!isLibrarySupported()) return [];
  const db = await openDatabase();
  try {
    const store = db.transaction(STORE, "readonly").objectStore(STORE);
    const rows = await runRequest(store.getAll() as IDBRequest<MediaEntry[]>);
    return sortByAdded(rows);
  } finally {
    db.close();
  }
}

/** Removes one entry, along with the bytes it held. */
export async function deleteMedia(id: string): Promise<void> {
  if (!isLibrarySupported()) return;
  const db = await openDatabase();
  try {
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    await runRequest(store.delete(id));
  } finally {
    db.close();
  }
}

/** Empties the library. */
export async function clearMedia(): Promise<void> {
  if (!isLibrarySupported()) return;
  const db = await openDatabase();
  try {
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    await runRequest(store.clear());
  } finally {
    db.close();
  }
}

/**
 * Reads a video's size and duration without keeping a decoder alive.
 * Returns zeros when the browser cannot read the file, so an unsupported codec
 * shows up as a missing duration rather than a fake one.
 */
export function probeMedia(
  file: File,
  kind: MediaKind
): Promise<{ durationSeconds: number; width: number; height: number; thumbnail: string }> {
  const empty = { durationSeconds: 0, width: 0, height: 0, thumbnail: "" };
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const element = kind === "video" ? document.createElement("video") : document.createElement("img");
    const cleanup = () => {
      element.removeAttribute("src");
      if (element instanceof HTMLVideoElement) element.load();
      URL.revokeObjectURL(url);
    };

    const fail = () => {
      cleanup();
      resolve(empty);
    };

    const draw = () => {
      const width = element instanceof HTMLVideoElement ? element.videoWidth : element.naturalWidth;
      const height = element instanceof HTMLVideoElement ? element.videoHeight : element.naturalHeight;
      let thumbnail = "";
      if (width > 0 && height > 0) {
        const scale = Math.min(1, 200 / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(element, 0, 0, canvas.width, canvas.height);
          thumbnail = canvas.toDataURL("image/jpeg", 0.6);
        }
      }
      cleanup();
      resolve({
        durationSeconds:
          element instanceof HTMLVideoElement && Number.isFinite(element.duration) ? element.duration : 0,
        width,
        height,
        thumbnail,
      });
    };

    element.addEventListener("error", fail, { once: true });
    if (element instanceof HTMLVideoElement) {
      element.muted = true;
      element.playsInline = true;
      element.preload = "metadata";
      // Frame grab needs a decoded frame, not just metadata.
      element.addEventListener("loadeddata", draw, { once: true });
      element.addEventListener("loadedmetadata", () => {
        element.currentTime = Math.min(0.1, Math.max(0, (element.duration || 1) * 0.05));
      }, { once: true });
    } else {
      element.addEventListener("load", draw, { once: true });
    }
    element.src = url;
  });
}

export type ImportResult = {
  added: MediaEntry[];
  failed: Array<{ name: string; reason: string }>;
};

/**
 * Copies picked files into the library. Folder-relative paths are preserved so
 * the grid can offer the same folder chips the picker showed.
 */
export async function importFiles(
  files: readonly File[],
  options: { onProgress?: (done: number, total: number) => void } = {}
): Promise<ImportResult> {
  const added: MediaEntry[] = [];
  const failed: ImportResult["failed"] = [];
  if (!isLibrarySupported()) {
    return { added, failed: files.map(file => ({ name: file.name, reason: "This browser cannot store a library." })) };
  }

  const db = await openDatabase();
  try {
    const existing = await runRequest(
      db.transaction(STORE, "readonly").objectStore(STORE).getAll() as IDBRequest<MediaEntry[]>
    );
    let count = existing.length;

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const kind: MediaKind = file.type.startsWith("image/") ? "image" : "video";
      if (!file.type.startsWith("video/") && !file.type.startsWith("image/")) {
        failed.push({ name: file.name, reason: "Not a video or photo." });
        options.onProgress?.(index + 1, files.length);
        continue;
      }
      if (count >= MAX_ENTRIES) {
        failed.push({ name: file.name, reason: `The library holds up to ${MAX_ENTRIES} items. Remove some first.` });
        options.onProgress?.(index + 1, files.length);
        continue;
      }

      const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
      const probe = await probeMedia(file, kind);
      const entry: MediaEntry = {
        id: `media-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        folder: folderFromPath(relative),
        kind,
        mimeType: file.type,
        size: file.size,
        durationSeconds: probe.durationSeconds,
        width: probe.width,
        height: probe.height,
        thumbnail: probe.thumbnail,
        addedAt: Date.now() + index,
        blob: file,
      };

      try {
        await runRequest(db.transaction(STORE, "readwrite").objectStore(STORE).put(entry));
        added.push(entry);
        count += 1;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        failed.push({
          name: file.name,
          reason: /quota/i.test(message)
            ? "The browser's storage is full. Remove some items and try again."
            : `Could not be stored: ${message}`,
        });
      }
      options.onProgress?.(index + 1, files.length);
    }
  } finally {
    db.close();
  }

  return { added, failed };
}
