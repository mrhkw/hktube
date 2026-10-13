import { FolderOpen, ImagePlus, Loader2, Play, Smartphone, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  deleteMedia,
  filterMedia,
  formatMediaDuration,
  formatMediaSize,
  groupFolders,
  importFiles,
  isFolderImportSupported,
  isLibrarySupported,
  listMedia,
  MAX_ENTRIES,
  type MediaEntry,
  type MediaKind,
} from "@/lib/mediaLibrary";

type KindFilter = "all" | MediaKind;

/**
 * The gallery step: folder chips across the top, a grid of imported media
 * below, and an import action.
 *
 * The library is real — imported files are stored in IndexedDB with their folder
 * path, so the fingers that show up are the ones that actually exist on this
 * device, not invented system folders.
 */
export default function GalleryStage({
  onPicked,
  onPhotoPicked,
  onCancel,
  photosOnly = false,
}: {
  onPicked: (entry: MediaEntry) => void;
  /** Photos cannot be trimmed as video; the studio routes them to a Post. */
  onPhotoPicked: (entry: MediaEntry) => void;
  onCancel: () => void;
  /** The Post flow only publishes a photo, so videos are hidden there. */
  photosOnly?: boolean;
}) {
  const [entries, setEntries] = useState<MediaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState<string | null>(null);
  const [kind, setKind] = useState<KindFilter>("all");
  const [selected, setSelected] = useState<MediaEntry | null>(null);
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);
  const [showPhotos, setShowPhotos] = useState(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const folderSupported = useMemo(() => isFolderImportSupported(), []);

  const refresh = useCallback(async () => {
    const rows = await listMedia();
    setEntries(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isLibrarySupported()) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [refresh]);

  const folders = useMemo(() => groupFolders(entries), [entries]);
  const visible = useMemo(
    () =>
      filterMedia(entries, {
        ...(folder ? { folder } : {}),
        kind: photosOnly ? "image" : showPhotos ? kind : "video",
      }),
    [entries, folder, kind, showPhotos, photosOnly]
  );

  async function ingest(files: File[]) {
    if (files.length === 0) return;
    setImporting({ done: 0, total: files.length });
    const result = await importFiles(files, {
      onProgress: (done, total) => setImporting({ done, total }),
    });
    setImporting(null);
    if (result.added.length > 0) await refresh();
    if (result.failed.length > 0) {
      toast.error(`${result.failed.length} file(s) could not be imported: ${result.failed[0].reason}`);
    }
    if (result.added.length > 0) {
      toast.success(
        `${result.added.length} item(s) added to your library. They stay on this device.`
      );
    }
  }

  async function removeEntry(entry: MediaEntry) {
    await deleteMedia(entry.id);
    if (selected?.id === entry.id) setSelected(null);
    await refresh();
    toast.success("Removed from your library.");
  }

  function confirmSelection() {
    if (!selected) return;
    if (selected.kind === "image") onPhotoPicked(selected);
    else onPicked(selected);
  }

  return (
    <>
      <div className="hkc-stage" style={{ alignItems: "stretch", padding: 0 }}>
        <div className="hkc-sheet" style={{ maxHeight: "none", height: "100%" }}>
          <div className="hkc-sheet-head">
            <span className="hkc-sheet-title">Gallery</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="hkc-pill hkc-pill--ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={Boolean(importing)}
              >
                {importing ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                {importing ? `${importing.done}/${importing.total}` : "Import"}
              </button>
              <button type="button" className="hkc-icon-btn" onClick={onCancel} aria-label="Close gallery">
                <X />
              </button>
            </div>
          </div>

          <div className="hkc-sheet-body">
            <div className="hkc-chips" style={{ marginBottom: 10 }}>
              <button
                type="button"
                className={"hkc-chip" + (folder === null ? " is-active" : "")}
                onClick={() => setFolder(null)}
              >
                All ({entries.length})
              </button>
              {folders.map(item => (
                <button
                  key={item.folder}
                  type="button"
                  className={"hkc-chip" + (folder === item.folder ? " is-active" : "")}
                  onClick={() => setFolder(item.folder)}
                  title={item.folder}
                >
                  {item.folder} ({item.count})
                </button>
              ))}
            </div>

            {photosOnly ? (
              <p className="hkc-row-hint" style={{ marginBottom: 12 }}>
                A post carries one photo. Videos are published as a Clip or a long video from the +
                menu.
              </p>
            ) : (
            <div className="hkc-chips" style={{ marginBottom: 12 }}>
              {(
                [
                  { id: "all" as KindFilter, label: "Both" },
                  { id: "video" as KindFilter, label: "Videos" },
                  { id: "image" as KindFilter, label: "Photos" },
                ] as const
              ).map(option => (
                <button
                  key={option.id}
                  type="button"
                  className={"hkc-chip" + (kind === option.id ? " is-active" : "")}
                  onClick={() => setKind(option.id)}
                >
                  {option.label}
                </button>
              ))}
              <label className="hkc-chip" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={showPhotos}
                  onChange={event => setShowPhotos(event.target.checked)}
                  style={{ marginRight: 6 }}
                />
                Show photos
              </label>
            </div>
            )}

            {loading ? (
              <div className="hkc-empty">
                <Loader2 className="size-6 animate-spin" style={{ margin: "0 auto 8px" }} />
                Reading your library…
              </div>
            ) : entries.length === 0 ? (
              <div className="hkc-empty">
                <Smartphone style={{ margin: "0 auto 10px" }} />
                <p style={{ fontWeight: 700, marginBottom: 6 }}>Your library is empty</p>
                <p style={{ fontSize: 12.5, opacity: 0.72, lineHeight: 1.5 }}>
                  A web page cannot browse your phone&apos;s Photos app or its Videos, DCIM and Camera
                  folders — only a native app can. Import the videos you want and they are stored here
                  on this device, so the grid, the folder chips, trimming and the editor all work on the
                  real file.
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
                  <button type="button" className="hkc-pill" onClick={() => fileInputRef.current?.click()}>
                    <ImagePlus className="size-4" />
                    Choose videos
                  </button>
                  {folderSupported && (
                    <button
                      type="button"
                      className="hkc-pill hkc-pill--ghost"
                      onClick={() => folderInputRef.current?.click()}
                    >
                      <FolderOpen className="size-4" />
                      Import a folder
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="hkc-media-grid">
                  {visible.map(entry => {
                    const isSelected = selected?.id === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className={"hkc-media-cell" + (isSelected ? " is-selected" : "")}
                        onClick={() => setSelected(entry)}
                        onDoubleClick={() => {
                          if (entry.kind === "image") onPhotoPicked(entry);
                          else onPicked(entry);
                        }}
                        title={`${entry.name} · ${formatMediaSize(entry.size)}`}
                        style={{ borderColor: isSelected ? "#fe2c55" : undefined }}
                      >
                        {entry.thumbnail ? (
                          <img src={entry.thumbnail} alt="" />
                        ) : (
                          <span className="grid h-full w-full place-items-center text-white/40">
                            <Play className="size-5" />
                          </span>
                        )}
                        {entry.kind === "video" && entry.durationSeconds > 0 && (
                          <span className="hkc-media-badge">{formatMediaDuration(entry.durationSeconds)}</span>
                        )}
                        {entry.kind === "image" && <span className="hkc-media-badge">Photo</span>}
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Remove ${entry.name}`}
                          className="hkc-media-order"
                          style={{ top: 4, left: 4, right: "auto" }}
                          onClick={event => {
                            event.stopPropagation();
                            void removeEntry(entry);
                          }}
                          onKeyDown={event => {
                            if (event.key === "Enter") {
                              event.stopPropagation();
                              void removeEntry(entry);
                            }
                          }}
                        >
                          <Trash2 className="size-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>

                {visible.length === 0 && (
                  <div className="hkc-empty" style={{ marginTop: 12 }}>
                    Nothing here for this filter. Switch folder, or import more media.
                  </div>
                )}

                <p className="hkc-note" style={{ marginTop: 12 }}>
                  The library keeps at most {MAX_ENTRIES} imported items, stored only in this browser.
                </p>
              </>
            )}
          </div>

          {selected && (
            <div
              style={{
                flex: "0 0 auto",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px max(16px, env(safe-area-inset-bottom))",
                borderTop: "1px solid rgb(255 255 255 / 8%)",
              }}
            >
              <span style={{ minWidth: 0, flex: 1, fontSize: 12.5, opacity: 0.8 }} title={selected.name}>
                <span style={{ display: "block", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selected.name}
                </span>
                {formatMediaSize(selected.size)}
                {selected.durationSeconds > 0 ? ` · ${formatMediaDuration(selected.durationSeconds)}` : ""}
              </span>
              <button
                type="button"
                className="hkc-pill"
                onClick={confirmSelection}
                disabled={selected.kind === "video" && selected.durationSeconds === 0}
              >
                {selected.kind === "image" ? "Continue" : "Next"}
              </button>
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*"
        multiple
        className="hidden"
        onChange={event => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void ingest(files);
        }}
      />
      {folderSupported && (
        <input
          ref={element => {
            folderInputRef.current = element;
            if (element) {
              element.setAttribute("webkitdirectory", "");
              element.setAttribute("directory", "");
              element.setAttribute("mozdirectory", "");
            }
          }}
          type="file"
          multiple
          className="hidden"
          onChange={event => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void ingest(files);
          }}
        />
      )}
    </>
  );
}
