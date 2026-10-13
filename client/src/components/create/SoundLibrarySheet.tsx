import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Music2, Pause, Play, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  filterSounds,
  listPlatformSounds,
  loadSoundAsBlob,
  soundLabel,
  SOUND_PAGE_SIZE,
  type PlatformSound,
} from "@/lib/musicLibrary";

type Filter = "all" | "clips" | "long";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All sounds" },
  { id: "clips", label: "From Clips" },
  { id: "long", label: "From videos" },
];

/**
 * The sound library behind the editor's "Sound" tool.
 *
 * YouTube's music library is a licensed catalogue; HkTube has none, so this lists
 * sounds that really exist here — the audio of published videos — with search,
 * preview and a "Use" action that mixes the chosen sound into the export.
 */
export default function SoundLibrarySheet({
  open,
  onClose,
  onUse,
}: {
  open: boolean;
  onClose: () => void;
  /** Called with a locally loaded sound, ready for the exporter. */
  onUse: (sound: PlatformSound, url: string, local: boolean) => void;
}) {
  const [sounds, setSounds] = useState<PlatformSound[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const debounce = useRef<number | null>(null);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listPlatformSounds({ query: search, limit: SOUND_PAGE_SIZE });
      setSounds(rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The sound library could not be loaded.");
      setSounds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load("");
    // Only on open: typing is handled by the debounced effect below.
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    if (debounce.current) window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => {
      void load(query.trim());
    }, 280);
    return () => {
      if (debounce.current) window.clearTimeout(debounce.current);
    };
  }, [query, open, load]);

  useEffect(() => {
    if (open) return;
    audioRef.current?.pause();
    setPreviewId(null);
  }, [open]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const visible = filterSounds(
    sounds.filter(sound => {
      if (filter === "clips") return sound.isShort;
      if (filter === "long") return !sound.isShort;
      return true;
    }),
    query
  );

  function togglePreview(sound: PlatformSound) {
    const audio = audioRef.current;
    if (!audio) return;
    if (previewId === sound.id) {
      audio.pause();
      setPreviewId(null);
      return;
    }
    audio.src = sound.audioUrl;
    audio.currentTime = 0;
    setPreviewId(sound.id);
    void audio.play().catch(() => {
      setPreviewId(null);
      toast.error("This browser blocked the preview. Tap again to allow playback.");
    });
  }

  async function use(sound: PlatformSound) {
    setLoadingId(sound.id);
    try {
      const loaded = await loadSoundAsBlob(sound);
      onUse(sound, loaded.url, loaded.local);
      if (!loaded.local) {
        toast.warning(
          "The sound could not be copied locally, so it is used by URL. If the export comes out silent, download the sound first."
        );
      }
      onClose();
    } finally {
      setLoadingId(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="hkc-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Sound library"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="hkc-dialog" style={{ width: "min(520px, 100%)", maxHeight: "86vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <h2 className="hkc-dialog-title">Sound library</h2>
          <button type="button" className="hkc-icon-btn" onClick={onClose} aria-label="Close sound library">
            <X />
          </button>
        </div>

        <div style={{ position: "relative", marginTop: 12 }}>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/45" />
          <input
            autoFocus
            className="hkc-field"
            style={{ width: "100%", paddingLeft: 34 }}
            placeholder="Search sounds and creators"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>

        <div className="hkc-chips" style={{ marginTop: 10 }}>
          {FILTERS.map(item => (
            <button
              key={item.id}
              type="button"
              className={"hkc-chip" + (filter === item.id ? " is-active" : "")}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", marginTop: 10 }}>
          {loading && sounds.length === 0 ? (
            <p className="hkc-row-hint">
              <Loader2 className="size-4 animate-spin" style={{ display: "inline", verticalAlign: "-3px" }} /> Loading
              sounds…
            </p>
          ) : error ? (
            <p className="hkc-row-hint" style={{ color: "#ffb3c1" }}>
              {error}
            </p>
          ) : visible.length === 0 ? (
            <p className="hkc-row-hint">
              {sounds.length === 0
                ? "No published videos yet, so there are no platform sounds to reuse. Import an audio file below instead."
                : "No sound matches that search."}
            </p>
          ) : (
            visible.map(sound => (
              <div key={sound.id} className="hkc-record-row" style={{ justifyContent: "space-between" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <button
                    type="button"
                    className="hkc-gallery-thumb"
                    style={{ width: 44, height: 44, flex: "0 0 auto" }}
                    onClick={() => togglePreview(sound)}
                    aria-label={previewId === sound.id ? `Pause ${sound.title}` : `Preview ${sound.title}`}
                  >
                    {sound.thumbnailUrl ? <img src={sound.thumbnailUrl} alt="" /> : <Music2 className="size-4" />}
                    <span
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        placeItems: "center",
                        background: "rgba(0,0,0,.35)",
                      }}
                    >
                      {previewId === sound.id ? <Pause className="size-4" /> : <Play className="size-4" />}
                    </span>
                  </button>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 600, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {soundLabel(sound)}
                    </span>
                    <span className="hkc-row-hint">
                      {sound.isShort ? "From a Clip" : "From a video"}
                      {sound.durationSeconds > 0 ? ` · ${Math.round(sound.durationSeconds)}s` : ""}
                    </span>
                  </span>
                </span>
                <button
                  type="button"
                  className="hkc-pill"
                  style={{ minHeight: 32, padding: "0 12px" }}
                  disabled={loadingId === sound.id}
                  onClick={() => void use(sound)}
                >
                  {loadingId === sound.id ? <Loader2 className="size-4 animate-spin" /> : null}
                  Use
                </button>
              </div>
            ))
          )}
        </div>

        <p className="hkc-note">
          These are sounds from videos already published on HkTube. HkTube has no licensed music catalogue, so the
          library does not invent one.
        </p>
        <audio ref={audioRef} onEnded={() => setPreviewId(null)} className="hidden" />
      </div>
    </div>
  );
}
