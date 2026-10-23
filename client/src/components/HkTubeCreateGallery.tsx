import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Album,
  ArrowLeft,
  Check,
  ChevronDown,
  Clock3,
  FileImage,
  Film,
  ImagePlus,
  MoreVertical,
  Search,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type CreateMediaMode = "video" | "clip" | "post";
type GalleryItem = {
  id: string;
  file: File;
  url: string;
  kind: "video" | "image";
  favorite: boolean;
  addedAt: number;
};
type Props = {
  onCancel: () => void;
  onSelect: (mode: CreateMediaMode, file: File) => void;
  initialMode?: CreateMediaMode;
};
type StoredGalleryItem = Omit<GalleryItem, "url">;
type GalleryFilter = "all" | "videos" | "photos" | "favorites";

const GALLERY_DB = "hktube-media-library";
const GALLERY_STORE = "media";

function openGalleryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        new Error("Local media storage is not supported in this browser.")
      );
      return;
    }
    const request = indexedDB.open(GALLERY_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(GALLERY_STORE)) {
        request.result.createObjectStore(GALLERY_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open the media library."));
  });
}

async function saveGalleryItems(items: StoredGalleryItem[]) {
  const db = await openGalleryDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(GALLERY_STORE, "readwrite");
      items.forEach(item => tx.objectStore(GALLERY_STORE).put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("Could not save selected media."));
      tx.onabort = () =>
        reject(tx.error ?? new Error("Saving selected media was cancelled."));
    });
  } finally {
    db.close();
  }
}

async function loadGalleryItems(): Promise<StoredGalleryItem[]> {
  const db = await openGalleryDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction(GALLERY_STORE, "readonly")
        .objectStore(GALLERY_STORE)
        .getAll();
      request.onsuccess = () =>
        resolve(
          (request.result as StoredGalleryItem[]).sort(
            (a, b) => b.addedAt - a.addedAt
          )
        );
      request.onerror = () =>
        reject(request.error ?? new Error("Could not load the media library."));
    });
  } finally {
    db.close();
  }
}

async function deleteGalleryItem(id: string) {
  const db = await openGalleryDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db
        .transaction(GALLERY_STORE, "readwrite")
        .objectStore(GALLERY_STORE)
        .delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(request.error ?? new Error("Could not remove media."));
    });
  } finally {
    db.close();
  }
}

const formatBytes = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export function HkTubeCreateGallery({
  onCancel,
  onSelect,
  initialMode = "video",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const [mode, setMode] = useState<CreateMediaMode>(initialMode);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [selected, setSelected] = useState("");
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void loadGalleryItems()
      .then(saved => {
        if (!active) return;
        const restored = saved.map(item => {
          const url = URL.createObjectURL(item.file);
          objectUrlsRef.current.add(url);
          return { ...item, url };
        });
        setItems(restored);
      })
      .catch(() => {
        if (active) setError("Saved media could not be loaded yet.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    },
    []
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter(item => {
      const typeOk =
        filter === "all" ||
        (filter === "videos" && item.kind === "video") ||
        (filter === "photos" && item.kind === "image") ||
        (filter === "favorites" && item.favorite);
      const modeOk =
        mode === "post" ? item.kind === "image" : item.kind === "video";
      return typeOk && modeOk && item.file.name.toLowerCase().includes(term);
    });
  }, [filter, items, mode, query]);

  const chosen = items.find(item => item.id === selected);
  const accept = mode === "post" ? "image/*" : "video/*";

  function changeMode(next: CreateMediaMode) {
    setMode(next);
    setSelected("");
    setFilter("all");
    setError("");
  }

  async function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length) return;
    const accepted = files.filter(file => {
      const supported =
        mode === "post"
          ? file.type.startsWith("image/")
          : file.type.startsWith("video/");
      return supported && file.size > 0;
    });
    if (!accepted.length) {
      setError(
        mode === "post"
          ? "Choose a photo for your post."
          : "Choose a video for this upload."
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const now = Date.now();
      const stored: StoredGalleryItem[] = accepted.map(file => ({
        id: crypto.randomUUID(),
        file,
        kind: file.type.startsWith("video/") ? "video" : "image",
        favorite: false,
        addedAt: now,
      }));
      await saveGalleryItems(stored);
      const next = stored.map(item => {
        const url = URL.createObjectURL(item.file);
        objectUrlsRef.current.add(url);
        return { ...item, url };
      });
      setItems(current => [...next, ...current]);
      setSelected(next[0]?.id ?? "");
    } catch {
      setError("Media could not be saved. Try one smaller file at a time.");
    } finally {
      setBusy(false);
    }
  }

  function removeItem(id: string) {
    const item = items.find(value => value.id === id);
    if (item) {
      URL.revokeObjectURL(item.url);
      objectUrlsRef.current.delete(item.url);
      void deleteGalleryItem(id).catch(() => undefined);
    }
    setItems(current => current.filter(value => value.id !== id));
    if (selected === id) setSelected("");
  }

  return (
    <section className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#08090d] text-white sm:min-h-0 sm:max-h-[94dvh] sm:rounded-[28px]">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#08090d]/95 px-4 pb-4 pt-[max(14px,env(safe-area-inset-top))] backdrop-blur-xl sm:px-6 sm:pt-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close gallery"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 text-white transition hover:bg-white/10"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-600">
              HKTUBE CREATOR
            </p>
            <h2 className="truncate text-xl font-black tracking-tight text-white">
              Create from gallery
            </h2>
          </div>
          <button
            type="button"
            aria-label="More gallery options"
            className="grid size-10 place-items-center rounded-full border border-white/10 text-white transition hover:bg-white/10"
          >
            <MoreVertical className="size-5" />
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[.06] px-3 py-2 text-xs font-bold text-white"
          >
            Recents <ChevronDown className="size-4" />
          </button>
          <p className="text-xs font-semibold text-slate-500">
            Private on this device
          </p>
        </div>
      </header>

      <div className="border-b border-white/10 bg-[#0d0f16] px-4 py-3 sm:px-6">
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["video", "Video", Video],
              ["clip", "Short", Film],
              ["post", "Post", FileImage],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => changeMode(key)}
              aria-pressed={mode === key}
              className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl border text-sm font-black transition ${mode === key ? "border-violet-400 bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/20" : "border-white/10 bg-white/[.035] text-slate-400 hover:bg-white/[.08]"}`}
            >
              <Icon className="size-5" /> {label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search media"
              aria-label="Search media"
              className="h-11 w-full rounded-2xl border border-white/10 bg-black/25 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400"
            />
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 text-sm font-black text-white shadow-lg shadow-violet-600/20 hover:from-violet-500 hover:to-fuchsia-500"
          >
            <ImagePlus className="size-4" /> {busy ? "Adding…" : "Add"}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={accept}
            className="hidden"
            onChange={importFiles}
          />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {(
            [
              ["all", "All"],
              ["videos", "Videos"],
              ["photos", "Photos"],
              ["favorites", "Favorites"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${filter === key ? "bg-white text-black" : "bg-white/[.07] text-slate-400 hover:bg-white/[.12]"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mx-4 mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm font-semibold text-rose-200 sm:mx-6"
        >
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,.18),transparent_42%),#08090d] px-2 pb-28 pt-3 sm:px-4">
        <p className="px-2 pb-2 text-xs font-black uppercase tracking-[.16em] text-slate-500">
          {formatDate(Date.now())}
        </p>
        {visible.length ? (
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5">
            {visible.map(item => (
              <div
                key={item.id}
                className={`relative aspect-square overflow-hidden rounded-xl bg-slate-900 shadow-lg shadow-black/20 ${selected === item.id ? "ring-4 ring-inset ring-violet-400 shadow-violet-500/30" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => setSelected(item.id)}
                  aria-label={`Select ${item.file.name}`}
                  aria-pressed={selected === item.id}
                  className="size-full text-left"
                >
                  {item.kind === "video" ? (
                    <video
                      src={item.url}
                      muted
                      playsInline
                      preload="metadata"
                      className="size-full object-cover"
                    />
                  ) : (
                    <img
                      src={item.url}
                      alt={item.file.name}
                      className="size-full object-cover"
                    />
                  )}
                  <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-lg bg-black/70 px-1.5 py-1 text-[10px] font-bold text-white">
                    <Clock3 className="size-3" />
                    {item.kind === "video" ? "Video" : "Photo"}
                  </span>
                  {selected === item.id && (
                    <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-violet-600 text-white shadow-lg">
                      <Check className="size-4" />
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label="Remove media"
                  className="absolute right-1 bottom-1 grid size-7 place-items-center rounded-full bg-black/65 text-white"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid min-h-[48dvh] place-items-center rounded-3xl border border-dashed border-white/15 bg-white/[.035] px-6 text-center shadow-2xl shadow-violet-950/20">
            <div>
              <Album className="mx-auto size-14 text-violet-500" />
              <h3 className="mt-4 text-xl font-black text-white">
                No media selected yet
              </h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-400">
                Add a video or photo from your device. HkTube keeps your
                imported media private until you publish.
              </p>
              <Button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-5 rounded-full bg-violet-600 px-6 font-black hover:bg-violet-500"
              >
                Add media
              </Button>
            </div>
          </div>
        )}
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0d0f16]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:absolute sm:inset-x-auto sm:bottom-0 sm:left-0 sm:right-0 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-white">
              {chosen ? chosen.file.name : "Choose media to continue"}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {chosen
                ? formatBytes(chosen.file.size)
                : "Your selection stays private"}
            </p>
          </div>
          <Button
            type="button"
            disabled={!chosen || busy}
            onClick={() => chosen && onSelect(mode, chosen.file)}
            className="h-12 rounded-full bg-gradient-to-r from-red-600 to-fuchsia-600 px-6 font-black text-white shadow-lg shadow-red-600/20 hover:from-red-500 hover:to-fuchsia-500"
          >
            Create video
          </Button>
        </div>
      </footer>
    </section>
  );
}
