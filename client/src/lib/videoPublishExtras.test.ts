import { describe, expect, it } from "vitest";
import { extrasRow, hasExtras, VIDEO_EXTRA_COLUMNS, type VideoExtras } from "./videoPublishExtras";

const allColumns = new Set<string>(VIDEO_EXTRA_COLUMNS);

function extras(patch: Partial<VideoExtras> = {}): VideoExtras {
  return {
    location: "",
    aiGenerated: false,
    ageRestricted: false,
    paidPromotion: false,
    brandName: "",
    remix: "video_and_audio",
    ...patch,
  };
}

describe("hasExtras", () => {
  it("is false for a plain upload, so no update is sent", () => {
    expect(hasExtras(extras())).toBe(false);
  });

  it("is true as soon as anything was chosen", () => {
    expect(hasExtras(extras({ location: "Islamabad" }))).toBe(true);
    expect(hasExtras(extras({ aiGenerated: true }))).toBe(true);
    expect(hasExtras(extras({ remix: "none" }))).toBe(true);
  });
});

describe("extrasRow", () => {
  it("writes only what the creator chose", () => {
    const { row, missing } = extrasRow(extras({ location: " Islamabad ", aiGenerated: true }), allColumns);
    expect(row).toEqual({ location: "Islamabad", ai_generated: true });
    expect(missing).toEqual([]);
  });

  it("stores a paid promotion with its brand", () => {
    const { row } = extrasRow(extras({ paidPromotion: true, brandName: " Acme " }), allColumns);
    expect(row.paid_promotion).toBe(true);
    expect(row.brand_name).toBe("Acme");
  });

  it("leaves the default remix policy unstored", () => {
    expect(extrasRow(extras({ remix: "video_and_audio" }), allColumns).row.remix_policy).toBeUndefined();
    expect(extrasRow(extras({ remix: "audio_only" }), allColumns).row.remix_policy).toBe("audio_only");
  });

  it("names the columns a database is missing instead of pretending to save", () => {
    const { row, missing } = extrasRow(
      extras({ location: "Lahore", ageRestricted: true }),
      new Set(["location"])
    );
    expect(row).toEqual({ location: "Lahore" });
    expect(missing).toEqual(["age_restricted"]);
  });
});
