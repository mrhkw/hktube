import {
  ChevronDown,
  Image as ImageIcon,
  Link2,
  ListVideo,
  MapPin,
  MessageSquare,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";

export type Visibility = "public" | "unlisted" | "private";

export type PublishDetails = {
  title: string;
  description: string;
  visibility: Visibility;
  madeForKids: boolean;
  ageRestricted: boolean;
  location: string;
  relatedVideoId: string;
  playlist: string;
  paidPromotion: boolean;
  brandName: string;
  allowComments: boolean;
  allowRemix: boolean;
  allowDownload: boolean;
  tags: string;
  aiGenerated: boolean;
};

export const EMPTY_DETAILS: PublishDetails = {
  title: "",
  description: "",
  visibility: "public",
  madeForKids: false,
  ageRestricted: false,
  location: "",
  relatedVideoId: "",
  playlist: "",
  paidPromotion: false,
  brandName: "",
  allowComments: true,
  allowRemix: true,
  allowDownload: false,
  tags: "",
  aiGenerated: false,
};

/**
 * The "Add details" page, laid out the way TikTok and YouTube Studio order it:
 * cover and caption first, then who can see it, then the audience declaration,
 * and finally everything else behind "Show more".
 */
export default function DetailsStage({
  details,
  onChange,
  coverUrl,
  isShort,
  hasCustomCover,
  onEditCover,
  playlists,
  onUpload,
  uploading,
  uploadProgress,
  uploadPhase,
  canUpload,
  blocker,
}: {
  details: PublishDetails;
  onChange: (patch: Partial<PublishDetails>) => void;
  coverUrl: string | null;
  isShort: boolean;
  hasCustomCover: boolean;
  onEditCover: () => void;
  playlists: string[];
  onUpload: () => void;
  uploading: boolean;
  uploadProgress: number;
  uploadPhase: string;
  canUpload: boolean;
  /** Explains what is still missing when the upload button is disabled. */
  blocker: string;
}) {
  const [showMore, setShowMore] = useState(false);
  const captionRemaining = 2200 - details.description.length;

  return (
    <>
      <div className="hkc-details">
        <div className="hkc-details-hero">
          <button
            type="button"
            className="hkc-cover-btn"
            onClick={onEditCover}
            aria-label="Choose a cover frame"
          >
            {coverUrl ? <img src={coverUrl} alt="Selected cover" /> : <ImageIcon className="size-6" style={{ margin: "auto" }} />}
            <span className="hkc-cover-badge">
              <ImageIcon className="size-3" />
              {hasCustomCover ? "Edit cover" : "Cover"}
            </span>
          </button>

          <div style={{ minWidth: 0, flex: 1 }}>
            <label className="hkc-label" htmlFor="hkc-title">
              {isShort ? "Caption your Short" : "Title (required)"}
            </label>
            <textarea
              id="hkc-title"
              className="hkc-field"
              rows={2}
              maxLength={isShort ? 150 : 180}
              placeholder={isShort ? "Add a caption for your Short…" : "Add a title that describes your video"}
              value={details.title}
              onChange={event => onChange({ title: event.target.value })}
            />

            <label className="hkc-label" htmlFor="hkc-description" style={{ marginTop: 10 }}>
              {isShort ? "Description" : "Description (optional)"}
            </label>
            <textarea
              id="hkc-description"
              className="hkc-field"
              rows={3}
              maxLength={2200}
              placeholder="Tell viewers about your video"
              value={details.description}
              onChange={event => onChange({ description: event.target.value })}
            />
            <p className="hkc-row-hint" style={{ textAlign: "right" }}>
              {captionRemaining} characters left
            </p>
          </div>
        </div>

        <div className="hkc-row">
          <div>
            <p className="hkc-row-label">Visibility</p>
            <p className="hkc-row-hint">Who can watch this video</p>
          </div>
          <select
            className="hkc-field"
            style={{ width: 150 }}
            value={details.visibility}
            onChange={event => onChange({ visibility: event.target.value as Visibility })}
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
        </div>

        <div className="hkc-row" style={{ alignItems: "flex-start", flexDirection: "column", gap: 8 }}>
          <div>
            <p className="hkc-row-label">Audience</p>
            <p className="hkc-row-hint">
              This helps HkTube comply with children's privacy law (COPPA). You must set this
              accurately for every upload.
            </p>
          </div>
          <div style={{ display: "grid", gap: 7, width: "100%" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5 }}>
              <input
                type="radio"
                name="hkc-audience"
                checked={!details.madeForKids}
                onChange={() => onChange({ madeForKids: false, ageRestricted: false })}
              />
              No, it&apos;s not made for kids
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5 }}>
              <input
                type="radio"
                name="hkc-audience"
                checked={details.madeForKids}
                onChange={() => onChange({ madeForKids: true, ageRestricted: false })}
              />
              Yes, it&apos;s made for kids
            </label>
            {details.madeForKids && (
              <p className="hkc-row-hint">
                Personalised ads and several discovery surfaces are switched off for this video.
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          className={"hkc-show-more" + (showMore ? " is-open" : "")}
          onClick={() => setShowMore(value => !value)}
          aria-expanded={showMore}
        >
          Show more
          <ChevronDown className="size-4" />
        </button>

        {showMore && (
          <>
            <div className="hkc-row">
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <MapPin className="size-4" />
                <div>
                  <p className="hkc-row-label">Location</p>
                  <p className="hkc-row-hint">Shown on the watch page</p>
                </div>
              </div>
              <input
                className="hkc-field"
                style={{ width: 180 }}
                maxLength={120}
                placeholder="Add a place"
                value={details.location}
                onChange={event => onChange({ location: event.target.value })}
              />
            </div>

            <div className="hkc-row">
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <Link2 className="size-4" />
                <div>
                  <p className="hkc-row-label">Related video</p>
                  <p className="hkc-row-hint">Link a video that continues this one</p>
                </div>
              </div>
              <input
                className="hkc-field"
                style={{ width: 180 }}
                placeholder="Video link or ID"
                value={details.relatedVideoId}
                onChange={event => onChange({ relatedVideoId: event.target.value })}
              />
            </div>

            <div className="hkc-row">
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <ListVideo className="size-4" />
                <div>
                  <p className="hkc-row-label">Add to playlist</p>
                  <p className="hkc-row-hint">
                    {playlists.length ? "Choose one of your playlists" : "You have no playlists yet"}
                  </p>
                </div>
              </div>
              <select
                className="hkc-field"
                style={{ width: 180 }}
                disabled={playlists.length === 0}
                value={details.playlist}
                onChange={event => onChange({ playlist: event.target.value })}
              >
                <option value="">None</option>
                {playlists.map(name => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="hkc-row">
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <Sparkles className="size-4" />
                <div>
                  <p className="hkc-row-label">Paid promotion &amp; brands</p>
                  <p className="hkc-row-hint">Disclose when a brand paid for this video</p>
                </div>
              </div>
              <Switch
                checked={details.paidPromotion}
                onCheckedChange={value => onChange({ paidPromotion: value, brandName: value ? details.brandName : "" })}
                aria-label="Paid promotion"
              />
            </div>

            {details.paidPromotion && (
              <div className="hkc-row">
                <p className="hkc-row-label">Brand name</p>
                <input
                  className="hkc-field"
                  style={{ width: 180 }}
                  maxLength={120}
                  placeholder="Brand"
                  value={details.brandName}
                  onChange={event => onChange({ brandName: event.target.value })}
                />
              </div>
            )}

            <div className="hkc-row">
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <Users className="size-4" />
                <div>
                  <p className="hkc-row-label">Collaborations</p>
                  <p className="hkc-row-hint">
                    Inviting a collaborator by handle needs an account lookup service, which is not
                    configured yet.
                  </p>
                </div>
              </div>
              <span className="hkc-chip" aria-disabled="true" style={{ opacity: 0.5, cursor: "default" }}>
                Not available
              </span>
            </div>

            <div className="hkc-row">
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <MessageSquare className="size-4" />
                <p className="hkc-row-label">Allow comments</p>
              </div>
              <Switch
                checked={details.allowComments}
                onCheckedChange={value => onChange({ allowComments: value })}
                aria-label="Allow comments"
              />
            </div>

            <div className="hkc-row">
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <MessageSquare className="size-4" />
                <div>
                  <p className="hkc-row-label">Allow remixing</p>
                  <p className="hkc-row-hint">Let others use this sound and clip</p>
                </div>
              </div>
              <Switch
                checked={details.allowRemix}
                onCheckedChange={value => onChange({ allowRemix: value })}
                aria-label="Allow remixing"
              />
            </div>

            <div className="hkc-row">
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <Tag className="size-4" />
                <div>
                  <p className="hkc-row-label">Tags</p>
                  <p className="hkc-row-hint">Comma separated, up to 30 tags</p>
                </div>
              </div>
              <input
                className="hkc-field"
                style={{ width: 180 }}
                placeholder="music, tutorial"
                value={details.tags}
                onChange={event => onChange({ tags: event.target.value })}
              />
            </div>

            <div className="hkc-row">
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <Sparkles className="size-4" />
                <div>
                  <p className="hkc-row-label">Altered or synthetic content</p>
                  <p className="hkc-row-hint">
                    Turn on if this video was made or meaningfully changed with AI
                  </p>
                </div>
              </div>
              <Switch
                checked={details.aiGenerated}
                onCheckedChange={value => onChange({ aiGenerated: value })}
                aria-label="AI generated content"
              />
            </div>

            <div className="hkc-row">
              <div>
                <p className="hkc-row-label">Age restriction</p>
                <p className="hkc-row-hint">Restrict this video to viewers over 18</p>
              </div>
              <Switch
                checked={details.ageRestricted}
                onCheckedChange={value => onChange({ ageRestricted: value, madeForKids: false })}
                aria-label="Age restriction"
              />
            </div>

            <div className="hkc-row">
              <div>
                <p className="hkc-row-label">Allow downloads</p>
                <p className="hkc-row-hint">Let viewers save this video to their device</p>
              </div>
              <Switch
                checked={details.allowDownload}
                onCheckedChange={value => onChange({ allowDownload: value })}
                aria-label="Allow downloads"
              />
            </div>
          </>
        )}
      </div>

      <div
        style={{
          flex: "0 0 auto",
          padding: "12px 16px max(16px, env(safe-area-inset-bottom))",
          borderTop: "1px solid rgb(255 255 255 / 8%)",
          background: "#111116",
        }}
      >
        {uploading && (
          <div style={{ marginBottom: 10 }}>
            <div className="hkc-progress">
              <div style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="hkc-row-hint" style={{ marginTop: 6 }}>
              {uploadPhase}
            </p>
          </div>
        )}
        <button
          type="button"
          className="hkc-pill"
          style={{ width: "100%", minHeight: 46, justifyContent: "center" }}
          disabled={!canUpload || uploading}
          onClick={onUpload}
        >
          {uploading ? `Uploading… ${uploadProgress}%` : isShort ? "Upload Short" : "Upload Video"}
        </button>
        {!canUpload && !uploading && (
          <p className="hkc-row-hint" style={{ marginTop: 8, textAlign: "center" }}>
            {blocker}
          </p>
        )}
      </div>
    </>
  );
}
