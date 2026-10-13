import { useEffect, useState } from "react";
import { Check, ListPlus, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export type PlaylistChoice = { id: string; title: string };

/**
 * "Add to playlists" row.
 *
 * Opens on a row with the playlists the creator already owns and a "New playlist"
 * option that creates one in place, the way YouTube's Add details page does.
 */
export default function PlaylistPicker({
  playlists,
  selected,
  onSelect,
  onPlaylistsChange,
}: {
  playlists: PlaylistChoice[];
  selected: string | null;
  onSelect: (playlistId: string | null) => void;
  onPlaylistsChange: (playlists: PlaylistChoice[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setCreating(false);
      setDraftTitle("");
    }
  }, [open]);

  const selectedTitle = playlists.find(playlist => playlist.id === selected)?.title ?? null;

  async function createPlaylist() {
    const title = draftTitle.trim();
    if (!title) return;
    setSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Your session expired. Sign in again.");
      const { data, error } = await supabase
        .from("playlists")
        .insert({ owner_id: userData.user.id, title, description: "", visibility: "private" })
        .select("id,title")
        .limit(1);
      if (error) throw new Error(error.message);
      const created = (data ?? [])[0] as { id: string | number; title: string } | undefined;
      if (!created) throw new Error("The playlist was not returned by the database.");
      const choice: PlaylistChoice = { id: String(created.id), title: created.title };
      onPlaylistsChange([choice, ...playlists]);
      onSelect(choice.id);
      toast.success(`Added to the new playlist "${choice.title}".`);
      setOpen(false);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "The playlist could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="hkc-row" style={{ marginTop: 12 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <ListPlus className="size-4 shrink-0" />
          <span style={{ minWidth: 0 }}>
            <p className="hkc-row-label" style={{ fontSize: 13 }}>
              Add to playlists
            </p>
            <p className="hkc-row-hint" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selectedTitle ? `Added to ${selectedTitle}` : "Choose a playlist, or create one"}
            </p>
          </span>
        </span>
        <button type="button" className="hkc-pill hkc-pill--ghost" onClick={() => setOpen(true)}>
          {selectedTitle ? "Change" : "Select"}
        </button>
      </div>

      {open && (
        <div
          className="hkc-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Add to playlists"
          onClick={event => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="hkc-dialog" style={{ width: "min(420px, 100%)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 className="hkc-dialog-title">Add to playlists</h2>
              <button type="button" className="hkc-icon-btn" onClick={() => setOpen(false)} aria-label="Close">
                <X />
              </button>
            </div>

            <div style={{ maxHeight: "46vh", overflowY: "auto", marginTop: 12 }}>
              {playlists.length === 0 && !creating && (
                <p className="hkc-row-hint">You have no playlists yet. Create one to save this video in a series.</p>
              )}
              {playlists.map(playlist => {
                const isSelected = playlist.id === selected;
                return (
                  <button
                    key={playlist.id}
                    type="button"
                    className="hkc-record-row"
                    style={{ width: "100%", background: "transparent", border: 0, cursor: "pointer" }}
                    onClick={() => onSelect(isSelected ? null : playlist.id)}
                  >
                    <span
                      className={"hkc-swatch" + (isSelected ? " is-active" : "")}
                      style={{
                        width: 18,
                        height: 18,
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,.35)",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {isSelected && <Check className="size-3" />}
                    </span>
                    <span style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                      <span style={{ display: "block", fontWeight: 600, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {playlist.title}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {creating ? (
              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                <input
                  autoFocus
                  className="hkc-field"
                  style={{ width: "100%" }}
                  maxLength={100}
                  placeholder="Playlist name"
                  value={draftTitle}
                  onChange={event => setDraftTitle(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void createPlaylist();
                    }
                  }}
                />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" className="hkc-pill hkc-pill--ghost" onClick={() => setCreating(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="hkc-pill"
                    disabled={!draftTitle.trim() || saving}
                    onClick={() => void createPlaylist()}
                  >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    Create
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="hkc-record-row"
                style={{ width: "100%", background: "transparent", border: 0, cursor: "pointer", marginTop: 8 }}
                onClick={() => setCreating(true)}
              >
                <Plus className="size-4" />
                <span style={{ fontWeight: 600, fontSize: 13.5, textAlign: "left" }}>New playlist</span>
              </button>
            )}

            <div className="hkc-dialog-actions" style={{ marginTop: 14 }}>
              <button type="button" className="hkc-pill" onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
