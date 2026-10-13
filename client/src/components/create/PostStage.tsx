import { ImagePlus, Link2, Loader2, X } from "lucide-react";
import type { MediaEntry } from "@/lib/mediaLibrary";
import { formatMediaSize } from "@/lib/mediaLibrary";

/**
 * Photo/text post composer.
 *
 * HkTube's post model stores one image per post, so this screen offers one photo
 * and says so rather than pretending a carousel will appear on the timeline.
 */
export default function PostStage({
  photo,
  thumbnailSrc,
  caption,
  link,
  publishing,
  progressLabel,
  onCaptionChange,
  onLinkChange,
  onOpenGallery,
  onClearPhoto,
  onPublish,
}: {
  photo: MediaEntry | null;
  thumbnailSrc: string;
  caption: string;
  link: string;
  publishing: boolean;
  progressLabel: string;
  onCaptionChange: (value: string) => void;
  onLinkChange: (value: string) => void;
  onOpenGallery: () => void;
  onClearPhoto: () => void;
  onPublish: () => void;
}) {
  const canPublish = Boolean(photo || caption.trim()) && !publishing;

  return (
    <>
      <div className="hkc-stage" style={{ alignItems: "stretch", padding: 0 }}>
        <div className="hkc-sheet" style={{ maxHeight: "none", height: "100%" }}>
          <div className="hkc-sheet-head">
            <span className="hkc-sheet-title">New post</span>
          </div>

          <div className="hkc-sheet-body">
            <div style={{ display: "flex", gap: 12 }}>
              <div
                role="button"
                tabIndex={0}
                className="hkc-cover-btn"
                style={{ width: 116, aspectRatio: "3 / 4", flex: "0 0 auto" }}
                onClick={onOpenGallery}
                onKeyDown={event => {
                  if (event.key === "Enter" || event.key === " ") onOpenGallery();
                }}
                aria-label={photo ? "Change photo" : "Add a photo"}
              >
                {thumbnailSrc ? (
                  <img src={thumbnailSrc} alt={photo?.name ?? "Selected photo"} />
                ) : (
                  <span className="grid h-full w-full place-content-center gap-1 text-white/55">
                    <ImagePlus className="size-5" style={{ margin: "auto" }} />
                    <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>Add photo</span>
                  </span>
                )}
                {photo && (
                  <span className="hkc-cover-badge">
                    <ImagePlus className="size-3" />
                    Change
                  </span>
                )}
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <label className="hkc-label" htmlFor="hkc-post-caption">
                  Caption
                </label>
                <textarea
                  id="hkc-post-caption"
                  className="hkc-field"
                  rows={4}
                  maxLength={5000}
                  placeholder="Say something about this post…"
                  value={caption}
                  onChange={event => onCaptionChange(event.target.value)}
                />

                <label className="hkc-label" htmlFor="hkc-post-link" style={{ marginTop: 10 }}>
                  <Link2 style={{ display: "inline", width: 13, height: 13, verticalAlign: "-2px" }} /> Link
                  (optional)
                </label>
                <input
                  id="hkc-post-link"
                  className="hkc-field"
                  placeholder="https://"
                  value={link}
                  onChange={event => onLinkChange(event.target.value)}
                />
              </div>
            </div>

            {photo && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <span className="hkc-row-hint" style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {photo.name} · {formatMediaSize(photo.size)}
                </span>
                <button type="button" className="hkc-pill hkc-pill--ghost" onClick={onClearPhoto} disabled={publishing}>
                  <X className="size-4" />
                  Remove
                </button>
              </div>
            )}

            <p className="hkc-note">
              HkTube posts carry one photo each. A photo post reaches followers the same way a text
              post does, and the photo is uploaded when you press Publish.
            </p>
          </div>

          <div
            style={{
              flex: "0 0 auto",
              padding: "12px 16px max(16px, env(safe-area-inset-bottom))",
              borderTop: "1px solid rgb(255 255 255 / 8%)",
            }}
          >
            {publishing && (
              <p className="hkc-row-hint" style={{ marginBottom: 8, textAlign: "center" }}>
                <Loader2 className="size-3.5 animate-spin" style={{ display: "inline", verticalAlign: "-2px" }} />{" "}
                {progressLabel}
              </p>
            )}
            <button
              type="button"
              className="hkc-pill"
              style={{ width: "100%", minHeight: 46, justifyContent: "center" }}
              disabled={!canPublish}
              onClick={onPublish}
            >
              {publishing ? "Publishing…" : "Publish post"}
            </button>
            {!canPublish && !publishing && (
              <p className="hkc-row-hint" style={{ marginTop: 8, textAlign: "center" }}>
                Add a photo or write a caption to publish.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
