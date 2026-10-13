import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AtSign,
  ChevronDown,
  Image as ImageIcon,
  ListPlus,
  MapPin,
  Radio,
  ShieldCheck,
  Sparkles,
  Tag as TagIcon,
  Users,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  addTag,
  applyMention,
  mentionState,
  normalizeTitle,
  parseTagInput,
  rankMentionCandidates,
  remainingCharacters,
  searchMentionCandidates,
  MAX_TAGS,
  TAG_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  type MentionCandidate,
} from "@/lib/channelIdentity";
import { audienceSummary, REMIX_OPTIONS, type PublishDetails, type RemixOption } from "@/lib/publishOptions";
import PlaylistPicker from "@/components/create/PlaylistPicker";

/**
 * YouTube Studio's "Add details" page.
 *
 * Same order as YouTube: cover, title, visibility, the audience declaration, the
 * expandable "Show more" sections, and the big Upload button pinned to the
 * bottom. One page serves both a long video and a Short, because YouTube uses one
 * page with different wording.
 */
export default function UploadDetailsPage({
  details,
  onChange,
  onUpload,
  isShort,
  coverUrl,
  hasCustomCover,
  onPickCover,
  onUploadFrame,
  playlists,
  onPlaylistsChange,
  uploading,
  canUpload,
  blocker,
  progressLabel,
  durationLabel,
  resolutionLabel,
  mentionCandidates,
}: {
  details: PublishDetails;
  onChange: (patch: Partial<PublishDetails>) => void;
  /** Starts the upload. */
  onUpload: () => void;
  isShort: boolean;
  coverUrl: string | null;
  hasCustomCover: boolean;
  onPickCover: () => void;
  /** Opens the device gallery so a thumbnail photo can be chosen. */
  onUploadFrame: () => void;
  playlists: Array<{ id: string; title: string }>;
  onPlaylistsChange: (playlists: Array<{ id: string; title: string }>) => void;
  uploading: boolean;
  canUpload: boolean;
  blocker: string;
  progressLabel: string;
  durationLabel: string;
  resolutionLabel: string;
  mentionCandidates: MentionCandidate[];
}) {
  const [showMore, setShowMore] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionPool, setMentionPool] = useState<MentionCandidate[]>(mentionCandidates);

  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const mentionTimer = useRef<number | null>(null);

  useEffect(() => setMentionPool(mentionCandidates), [mentionCandidates]);

  useEffect(() => {
    return () => {
      if (mentionTimer.current) window.clearTimeout(mentionTimer.current);
    };
  }, []);

  /** Looks up channels for the @mention popup, debounced while typing. */
  const loadMentions = useCallback((query: string) => {
    if (mentionTimer.current) window.clearTimeout(mentionTimer.current);
    mentionTimer.current = window.setTimeout(() => {
      void searchMentionCandidates(query).then(rows => {
        if (rows.length > 0) setMentionPool(rows);
      });
    }, 220);
  }, []);

  const mentionOptions = useMemo(
    () => rankMentionCandidates(mentionPool, mentionQuery),
    [mentionPool, mentionQuery]
  );

  function handleTitleInput(value: string) {
    const element = titleRef.current;
    const caret = element?.selectionStart ?? value.length;
    const state = mentionState(value, caret);
    setMentionOpen(state.active);
    setMentionQuery(state.query);
    if (state.active) loadMentions(state.query);
    onChange({ title: value });
  }

  function chooseMention(handle: string) {
    const element = titleRef.current;
    const caret = element?.selectionStart ?? details.title.length;
    const applied = applyMention(details.title, caret, handle);
    onChange({ title: applied.value });
    setMentionOpen(false);
    window.requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(applied.caret, applied.caret);
    });
  }

  function commitTagList(raw: string) {
    const parsed = raw.includes(",") ? parseTagInput(raw) : [raw];
    let next = details.tags;
    let error: string | null = null;
    for (const candidate of parsed) {
      const result = addTag(next, candidate);
      next = result.tags;
      if (result.error) error = result.error;
    }
    onChange({ tags: next });
    setTagError(error);
    setTagDraft("");
  }

  const isPublic = details.visibility === "public";

  return (
    <>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 16px 24px" }}>
        {/* Cover --------------------------------------------------------- */}
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ position: "relative", flex: "0 0 auto" }}>
            <button
              type="button"
              onClick={onPickCover}
              className="hkc-cover-btn"
              style={{ width: 150, aspectRatio: isShort ? "9 / 16" : "16 / 9" }}
              aria-label="Select or edit the video thumbnail"
            >
              {coverUrl ? (
                <img src={coverUrl} alt="Video thumbnail" />
              ) : (
                <span style={{ display: "grid", placeItems: "center", height: "100%" }}>
                  <ImageIcon className="size-6" />
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onPickCover}
              aria-label="Edit thumbnail frame"
              title="Select a cover frame"
              className="hkc-icon-btn"
              style={{ position: "absolute", left: 8, bottom: 8, width: 30, height: 30, background: "rgba(0,0,0,.68)" }}
            >
              <ImageIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={onUploadFrame}
              className="hkc-pill hkc-pill--ghost"
              style={{ position: "absolute", right: 8, bottom: 8, minHeight: 28, padding: "0 8px", fontSize: 11 }}
            >
              Change photo
            </button>
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ position: "relative" }}>
              <textarea
                ref={titleRef}
                className="hkc-field"
                rows={2}
                maxLength={TITLE_MAX_LENGTH}
                aria-label={isShort ? "Caption" : "Title"}
                placeholder={
                  isShort ? "Caption your Short" : "Create a title (type @ to mention a channel)"
                }
                value={details.title}
                onChange={event => handleTitleInput(event.target.value)}
                onBlur={() => {
                  setMentionOpen(false);
                  const clean = normalizeTitle(details.title);
                  if (clean !== details.title) onChange({ title: clean });
                }}
              />
              {mentionOpen && mentionOptions.length > 0 && (
                <div
                  className="hkc-dialog"
                  style={{
                    position: "absolute",
                    zIndex: 30,
                    top: "100%",
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    padding: 6,
                    width: "auto",
                  }}
                >
                  {mentionOptions.map(candidate => (
                    <button
                      key={candidate.handle}
                      type="button"
                      onMouseDown={event => {
                        event.preventDefault();
                        chooseMention(candidate.handle);
                      }}
                      className="hkc-record-row"
                      style={{ width: "100%", background: "transparent", border: 0, cursor: "pointer" }}
                    >
                      <AtSign className="size-3.5" />
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>@{candidate.handle}</span>
                      <span style={{ fontSize: 12, opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {candidate.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="hkc-row-hint" style={{ textAlign: "right", marginTop: 4 }}>
              {remainingCharacters(details.title, TITLE_MAX_LENGTH)} characters left
            </p>
            <p className="hkc-row-hint" style={{ marginTop: 2 }}>
              {isShort ? "Short" : "Video"} · {durationLabel} · {resolutionLabel} · {audienceSummary(details)}
            </p>
            {hasCustomCover && (
              <p className="hkc-row-hint" style={{ marginTop: 2, color: "#8ef0b6" }}>
                <ShieldCheck className="size-3" style={{ display: "inline", verticalAlign: "-2px" }} /> Custom thumbnail
                selected
              </p>
            )}
          </div>
        </div>

        {/* Visibility ---------------------------------------------------- */}
        <div style={{ marginTop: 16 }}>
          <p className="hkc-row-label">Visibility</p>
          <p className="hkc-row-hint">Choose when to publish and who can see it</p>
          <select
            className="hkc-field"
            style={{ width: "100%", marginTop: 6 }}
            value={details.visibility}
            onChange={event => onChange({ visibility: event.target.value as PublishDetails["visibility"] })}
            aria-label="Visibility"
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>

          {isPublic && !isShort && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13.5, marginTop: 10 }}>
              <input
                type="checkbox"
                checked={details.instantPremiere}
                disabled={!details.premiereAvailable}
                onChange={event => onChange({ instantPremiere: event.target.checked })}
                style={{ marginTop: 3 }}
              />
              <span style={{ opacity: details.premiereAvailable ? 1 : 0.65 }}>
                Set as instant Premiere
                <span className="hkc-row-hint" style={{ display: "block" }}>
                  {details.premiereAvailable
                    ? "Adds a countdown before the video goes live."
                    : "Premieres need a live playback pipeline with a countdown, which HkTube does not run yet, so this stays disabled rather than promising one."}
                </span>
              </span>
            </label>
          )}

          {isPublic && isShort && (
            <p className="hkc-row-hint" style={{ marginTop: 8 }}>
              <Radio className="size-3.5" style={{ display: "inline", verticalAlign: "-2px" }} /> Shorts publish straight
              to the Clips feed.
            </p>
          )}
        </div>

        {/* Audience ------------------------------------------------------ */}
        <div style={{ marginTop: 16 }}>
          <p className="hkc-row-label">Audience</p>
          <p className="hkc-row-hint">
            Is this video made for kids? Regardless of your location, you are legally required to comply with
            children&apos;s privacy laws such as COPPA. See the Help Center for more details.
          </p>
          <div style={{ display: "grid", gap: 7, marginTop: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5 }}>
              <input
                type="radio"
                name="hktube-audience"
                checked={details.madeForKids}
                onChange={() => onChange({ madeForKids: true, ageRestricted: false })}
              />
              Yes, it&apos;s made for kids
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5 }}>
              <input
                type="radio"
                name="hktube-audience"
                checked={!details.madeForKids}
                onChange={() => onChange({ madeForKids: false })}
              />
              No, it&apos;s not made for kids
            </label>
          </div>

          <button
            type="button"
            className={"hkc-show-more" + (details.agePanelOpen ? " is-open" : "")}
            onClick={() => onChange({ agePanelOpen: !details.agePanelOpen })}
            aria-expanded={details.agePanelOpen}
            style={{ marginTop: 10 }}
          >
            Age restriction (advanced)
            <ChevronDown className="size-4" />
          </button>
          {details.agePanelOpen &&
            (details.madeForKids ? (
              <p className="hkc-row-hint">A video made for kids cannot also be age restricted.</p>
            ) : (
              <label style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13.5 }}>
                <input
                  type="checkbox"
                  checked={details.ageRestricted}
                  onChange={event => onChange({ ageRestricted: event.target.checked })}
                  style={{ marginTop: 3 }}
                />
                <span>
                  Restrict this video to viewers over 18
                  <span className="hkc-row-hint" style={{ display: "block" }}>
                    Age restricted videos are kept out of signed-out feeds.
                  </span>
                </span>
              </label>
            ))}
        </div>

        {/* Show more ----------------------------------------------------- */}
        <button
          type="button"
          className={"hkc-show-more" + (showMore ? " is-open" : "")}
          onClick={() => setShowMore(value => !value)}
          aria-expanded={showMore}
          style={{ marginTop: 16 }}
        >
          Show more
          <ChevronDown className="size-4" />
        </button>

        {showMore && (
          <>
            <div style={{ marginTop: 14 }}>
              <p className="hkc-row-label">Description</p>
              <textarea
                className="hkc-field"
                rows={4}
                maxLength={5000}
                style={{ width: "100%", marginTop: 6 }}
                placeholder="Tell viewers about your video (type @ to mention a channel)"
                value={details.description}
                onChange={event => onChange({ description: event.target.value })}
              />
            </div>

            <div className="hkc-row" style={{ marginTop: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <MapPin className="size-4" />
                <span>
                  <p className="hkc-row-label" style={{ fontSize: 13 }}>
                    Location
                  </p>
                  <p className="hkc-row-hint">Shown on the watch page</p>
                </span>
              </span>
              <input
                className="hkc-field"
                style={{ width: 170 }}
                maxLength={120}
                placeholder="Add a location"
                value={details.location}
                onChange={event => onChange({ location: event.target.value })}
              />
            </div>

            <PlaylistPicker
              playlists={playlists}
              selected={details.playlistId}
              onSelect={playlistId => onChange({ playlistId })}
              onPlaylistsChange={onPlaylistsChange}
            />

            <div className="hkc-row" style={{ marginTop: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <Sparkles className="size-4" />
                <span>
                  <p className="hkc-row-label" style={{ fontSize: 13 }}>
                    Paid promotion &amp; brands
                  </p>
                  <p className="hkc-row-hint">Disclose when a brand paid for this video</p>
                </span>
              </span>
              <Switch
                checked={details.paidPromotion}
                onCheckedChange={value => onChange({ paidPromotion: value })}
                aria-label="Paid promotion"
              />
            </div>
            {details.paidPromotion && (
              <div className="hkc-row" style={{ marginTop: 8 }}>
                <p className="hkc-row-label" style={{ fontSize: 13 }}>
                  Brand name
                </p>
                <input
                  className="hkc-field"
                  style={{ width: 170 }}
                  maxLength={120}
                  placeholder="Brand name"
                  value={details.brandName}
                  onChange={event => onChange({ brandName: event.target.value })}
                />
              </div>
            )}

            {/* Community -------------------------------------------------- */}
            <div style={{ marginTop: 14 }}>
              <p className="hkc-row-label">Community</p>

              <div className="hkc-row" style={{ marginTop: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <Users className="size-4" />
                  <span>
                    <p className="hkc-row-label" style={{ fontSize: 13 }}>
                      Invite a collaborator
                    </p>
                    <p className="hkc-row-hint">
                      Collab invites need an account lookup and an approval flow HkTube does not run yet, so this
                      stays closed rather than pretending to send one.
                    </p>
                  </span>
                </span>
                <span className="hkc-chip" aria-disabled="true" style={{ opacity: 0.5, cursor: "default" }}>
                  Not available
                </span>
              </div>

              <div className="hkc-row" style={{ marginTop: 10 }}>
                <span>
                  <p className="hkc-row-label" style={{ fontSize: 13 }}>
                    Comments
                  </p>
                  <p className="hkc-row-hint">Choose whether viewers can comment</p>
                </span>
                <select
                  className="hkc-field"
                  style={{ width: 130 }}
                  value={details.allowComments ? "on" : "off"}
                  onChange={event => onChange({ allowComments: event.target.value === "on" })}
                  aria-label="Comments"
                >
                  <option value="on">On</option>
                  <option value="off">Off</option>
                </select>
              </div>

              <div style={{ marginTop: 10 }}>
                <p className="hkc-row-label" style={{ fontSize: 13 }}>
                  Shorts remixing
                </p>
                <p className="hkc-row-hint">Who can remix this content</p>
                <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                  {REMIX_OPTIONS.map(option => (
                    <label key={option.id} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13 }}>
                      <input
                        type="radio"
                        name="hktube-remix"
                        checked={details.remix === option.id}
                        onChange={() => onChange({ remix: option.id as RemixOption })}
                        style={{ marginTop: 3 }}
                      />
                      <span>
                        {option.label}
                        <span className="hkc-row-hint" style={{ display: "block" }}>
                          {option.hint}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Attributes -------------------------------------------------- */}
            <div style={{ marginTop: 14 }}>
              <p className="hkc-row-label">Attributes</p>

              <div className="hkc-row" style={{ marginTop: 8 }}>
                <span>
                  <p className="hkc-row-label" style={{ fontSize: 13 }}>
                    AI use
                  </p>
                  <p className="hkc-row-hint">Was this content meaningfully created or changed with AI?</p>
                </span>
                <select
                  className="hkc-field"
                  style={{ width: 130 }}
                  value={details.aiGenerated ? "yes" : "no"}
                  onChange={event => onChange({ aiGenerated: event.target.value === "yes" })}
                  aria-label="AI use"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>

              <div style={{ marginTop: 10 }}>
                <p className="hkc-row-label" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  <TagIcon className="size-3.5" /> Add tags
                </p>
                <p className="hkc-row-hint">Tags help viewers find your video. Press Enter to add one.</p>
                {details.tags.length > 0 && (
                  <div className="hkc-chips" style={{ marginTop: 8 }}>
                    {details.tags.map(tag => (
                      <span key={tag} className="hkc-chip is-active" style={{ gap: 6 }}>
                        {tag}
                        <button
                          type="button"
                          aria-label={`Remove tag ${tag}`}
                          onClick={() => onChange({ tags: details.tags.filter(item => item !== tag) })}
                          style={{ background: "none", border: 0, color: "inherit", cursor: "pointer", display: "grid" }}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  className="hkc-field"
                  style={{ width: "100%", marginTop: 8 }}
                  placeholder={details.tags.length >= MAX_TAGS ? "Tag limit reached" : "Add a tag and press Enter"}
                  maxLength={TAG_MAX_LENGTH}
                  disabled={details.tags.length >= MAX_TAGS}
                  value={tagDraft}
                  onChange={event => setTagDraft(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter" || event.key === ",") {
                      event.preventDefault();
                      if (tagDraft.trim()) commitTagList(tagDraft);
                    } else if (event.key === "Backspace" && !tagDraft && details.tags.length > 0) {
                      onChange({ tags: details.tags.slice(0, -1) });
                    }
                  }}
                  onBlur={() => {
                    if (tagDraft.trim()) commitTagList(tagDraft);
                  }}
                />
                {tagError && (
                  <p className="hkc-row-hint" style={{ color: "#ffb3c1" }}>
                    {tagError}
                  </p>
                )}
                <p className="hkc-row-hint">
                  {details.tags.length}/{MAX_TAGS} tags
                </p>
              </div>
            </div>

            <div className="hkc-row" style={{ marginTop: 12 }}>
              <span>
                <p className="hkc-row-label" style={{ fontSize: 13 }}>
                  Allow downloads
                </p>
                <p className="hkc-row-hint">Let viewers save this video to their device</p>
              </span>
              <Switch
                checked={details.allowDownload}
                onCheckedChange={value => onChange({ allowDownload: value })}
                aria-label="Allow downloads"
              />
            </div>
          </>
        )}
      </div>

      {/* Upload action ---------------------------------------------------- */}
      <div
        style={{
          flex: "0 0 auto",
          padding: "12px 16px max(16px, env(safe-area-inset-bottom))",
          borderTop: "1px solid rgb(255 255 255 / 8%)",
          background: "#0f0f0f",
        }}
      >
        {uploading && (
          <p className="hkc-row-hint" style={{ marginBottom: 8, textAlign: "center" }}>
            {progressLabel}
          </p>
        )}
        <button
          type="button"
          className="hkc-pill"
          style={{ width: "100%", minHeight: 46, justifyContent: "center" }}
          disabled={!canUpload || uploading}
          onClick={onUpload}
        >
          {uploading ? "Uploading…" : isShort ? "Upload Short" : "Upload"}
        </button>
        {!canUpload && !uploading && (
          <p className="hkc-row-hint" style={{ marginTop: 8, textAlign: "center" }}>
            {blocker}
          </p>
        )}
        <p className="hkc-row-hint" style={{ marginTop: 8, textAlign: "center" }}>
          <ListPlus className="size-3" style={{ display: "inline", verticalAlign: "-2px" }} /> HkTube checks uploads
          before they appear publicly.
        </p>
      </div>
    </>
  );
}
