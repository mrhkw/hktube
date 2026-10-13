import { describe, expect, it } from "vitest";
import {
  audienceSummary,
  EMPTY_PUBLISH_DETAILS,
  playlistsToAdd,
  remixLabel,
  validatePublishDetails,
  type PublishDetails,
} from "./publishOptions";

function details(patch: Partial<PublishDetails> = {}): PublishDetails {
  return { ...EMPTY_PUBLISH_DETAILS, title: "A title", ...patch };
}

describe("defaults", () => {
  it("starts public, not made for kids, and available in the Clips feed", () => {
    expect(EMPTY_PUBLISH_DETAILS.visibility).toBe("public");
    expect(EMPTY_PUBLISH_DETAILS.madeForKids).toBe(false);
    expect(EMPTY_PUBLISH_DETAILS.ageRestricted).toBe(false);
    expect(EMPTY_PUBLISH_DETAILS.remix).toBe("video_and_audio");
    expect(EMPTY_PUBLISH_DETAILS.tags).toEqual([]);
  });

  it("does not offer an instant Premiere the platform cannot run", () => {
    expect(EMPTY_PUBLISH_DETAILS.premiereAvailable).toBe(false);
    expect(EMPTY_PUBLISH_DETAILS.instantPremiere).toBe(false);
  });
});

describe("validatePublishDetails", () => {
  it("accepts a complete upload", () => {
    const result = validatePublishDetails(details(), { isShort: false, durationSeconds: 90, hasCover: true });
    expect(result.ok).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("asks for a title, with the wording each flow uses", () => {
    expect(validatePublishDetails(details({ title: "  " }), {}).blockers[0]).toContain("title");
    expect(validatePublishDetails(details({ title: "" }), { isShort: true }).blockers[0]).toContain("caption");
  });

  it("refuses made for kids together with an age restriction", () => {
    const result = validatePublishDetails(details({ madeForKids: true, ageRestricted: true }), {});
    expect(result.ok).toBe(false);
    expect(result.blockers.join(" ")).toContain("age restricted");
  });

  it("refuses an instant Premiere when premieres are unavailable", () => {
    const result = validatePublishDetails(details({ instantPremiere: true }), {});
    expect(result.ok).toBe(false);
    expect(result.blockers.join(" ")).toContain("Premiere");
  });

  it("asks for the brand name when paid promotion is on", () => {
    const result = validatePublishDetails(details({ paidPromotion: true }), {});
    expect(result.ok).toBe(false);
    expect(result.blockers.join(" ")).toContain("brand");
    expect(validatePublishDetails(details({ paidPromotion: true, brandName: "Acme" }), {}).ok).toBe(true);
  });

  it("refuses an empty Clip and a Clip over three minutes", () => {
    expect(validatePublishDetails(details(), { isShort: true, durationSeconds: 0 }).blockers.join(" ")).toContain("empty");
    expect(validatePublishDetails(details(), { isShort: true, durationSeconds: 200 }).blockers.join(" ")).toContain("3 minutes");
    expect(validatePublishDetails(details(), { isShort: true, durationSeconds: 179 }).ok).toBe(true);
  });

  it("notes the things that are not blockers", () => {
    const result = validatePublishDetails(
      details({ aiGenerated: true, visibility: "unlisted", madeForKids: true }),
      { hasCover: false }
    );
    expect(result.notes.join(" ")).toContain("synthetic");
    expect(result.notes.join(" ")).toContain("Unlisted");
    expect(result.notes.join(" ")).toContain("cover");
    expect(result.notes.join(" ")).toContain("made for kids");
  });
});

describe("audienceSummary", () => {
  it("reads like a one line summary", () => {
    expect(audienceSummary(details())).toBe("Public · Not made for kids");
    expect(audienceSummary(details({ madeForKids: true, visibility: "private" }))).toBe("Private · Made for kids");
    expect(audienceSummary(details({ ageRestricted: true }))).toBe("Public · Not made for kids · 18+");
  });
});

describe("remixLabel and playlistsToAdd", () => {
  it("names the remix choices the way the page lists them", () => {
    expect(remixLabel("video_and_audio")).toBe("Allow video and audio remixing");
    expect(remixLabel("audio_only")).toBe("Allow only audio remixing");
    expect(remixLabel("none")).toBe("Don't allow remixing");
  });

  it("turns the chosen playlist into an add list", () => {
    expect(playlistsToAdd("42")).toEqual(["42"]);
    expect(playlistsToAdd(null)).toEqual([]);
  });
});
