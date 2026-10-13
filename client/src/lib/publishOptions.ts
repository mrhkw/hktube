/**
 * Everything the YouTube-style "Add details" page collects, plus the rules that
 * decide whether an upload may go out at all. Kept separate from the page so the
 * rules can be tested without a browser.
 */

export type Visibility = "public" | "unlisted" | "private";

/** The three Shorts remixing choices YouTube offers. */
export const REMIX_OPTIONS = [
  {
    id: "video_and_audio",
    label: "Allow video and audio remixing",
    hint: "Others can use this video and its sound in their Shorts.",
  },
  {
    id: "audio_only",
    label: "Allow only audio remixing",
    hint: "Others can use the sound, but not the picture.",
  },
  {
    id: "none",
    label: "Don't allow remixing",
    hint: "Nobody can remix this video or its sound.",
  },
] as const;

export type RemixOption = (typeof REMIX_OPTIONS)[number]["id"];

export type PublishDetails = {
  title: string;
  description: string;
  visibility: Visibility;
  madeForKids: boolean;
  ageRestricted: boolean;
  /** Whether the advanced age restriction panel is open. */
  agePanelOpen: boolean;
  /** "Set as instant Premiere" — only offered when the platform can run one. */
  instantPremiere: boolean;
  /** False when premieres are not available, which disables the checkbox. */
  premiereAvailable: boolean;
  location: string;
  playlistId: string | null;
  paidPromotion: boolean;
  brandName: string;
  allowComments: boolean;
  allowDownload: boolean;
  remix: RemixOption;
  aiGenerated: boolean;
  tags: string[];
};

export const EMPTY_PUBLISH_DETAILS: PublishDetails = {
  title: "",
  description: "",
  visibility: "public",
  madeForKids: false,
  ageRestricted: false,
  agePanelOpen: false,
  instantPremiere: false,
  // HkTube has no premiere pipeline, so the box is offered but disabled, and the
  // page says why instead of promising a countdown that would never run.
  premiereAvailable: false,
  location: "",
  playlistId: null,
  paidPromotion: false,
  brandName: "",
  allowComments: true,
  allowDownload: false,
  remix: "video_and_audio",
  aiGenerated: false,
  tags: [],
};

export type PublishValidation = {
  ok: boolean;
  /** Reasons shown next to the Upload button, most important first. */
  blockers: string[];
  /** Non-fatal remarks shown as notes. */
  notes: string[];
};

/**
 * Checks the details page before an upload starts. This mirrors the rules the
 * upload API enforces, so a creator finds out here rather than after waiting for
 * an upload to finish.
 */
export function validatePublishDetails(
  details: PublishDetails,
  options: { isShort?: boolean; durationSeconds?: number; hasCover?: boolean } = {}
): PublishValidation {
  const blockers: string[] = [];
  const notes: string[] = [];
  const title = details.title.trim();

  if (!title) {
    blockers.push(options.isShort ? "Add a caption for your Short." : "Add a title for your video.");
  }
  if (details.madeForKids && details.ageRestricted) {
    blockers.push("A video made for kids cannot also be age restricted.");
  }
  if (details.paidPromotion && !details.brandName.trim()) {
    blockers.push("Add the brand name, or turn paid promotion off.");
  }
  if (details.instantPremiere && !details.premiereAvailable) {
    blockers.push("Premieres are not available, so this video cannot start as an instant Premiere.");
  }
  if (typeof options.durationSeconds === "number" && options.durationSeconds <= 0) {
    blockers.push("The selected clip is empty. Trim it so it has a length.");
  }
  if (options.isShort && typeof options.durationSeconds === "number" && options.durationSeconds > 180) {
    blockers.push("Clips can be up to 3 minutes. Trim it, or publish it as a long video.");
  }

  if (!options.hasCover) {
    notes.push("No cover frame chosen yet; HkTube will pick one from the video.");
  }
  if (details.aiGenerated) {
    notes.push("Viewers will see an altered or synthetic content label.");
  }
  if (details.visibility === "unlisted") {
    notes.push("Unlisted videos are only reachable by link.");
  }
  if (details.visibility === "private") {
    notes.push("Private videos are visible to you only until you publish them.");
  }
  if (details.madeForKids) {
    notes.push("Comments and personalised ads are switched off for videos made for kids.");
  }

  return { ok: blockers.length === 0, blockers, notes };
}

/** One line describing who this upload is for, used by the summary line. */
export function audienceSummary(details: PublishDetails): string {
  const audience = details.madeForKids ? "Made for kids" : "Not made for kids";
  const restriction = details.ageRestricted ? " · 18+" : "";
  const visibility = details.visibility.charAt(0).toUpperCase() + details.visibility.slice(1);
  return `${visibility} · ${audience}${restriction}`;
}

/** Human label for a remix choice. */
export function remixLabel(id: RemixOption): string {
  return REMIX_OPTIONS.find(option => option.id === id)?.label ?? REMIX_OPTIONS[0].label;
}

/** Playlists the upload should be added to, as ids. */
export function playlistsToAdd(playlistId: string | null): string[] {
  return playlistId ? [playlistId] : [];
}
