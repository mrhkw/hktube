import { describe, expect, it } from "vitest";
import {
  filterSounds,
  normalizeSoundQuery,
  soundLabel,
  SOUND_PAGE_SIZE,
  type PlatformSound,
} from "./musicLibrary";

function sound(patch: Partial<PlatformSound> = {}): PlatformSound {
  return {
    id: patch.id ?? `sound-${Math.random()}`,
    title: patch.title ?? "Original sound",
    channelName: patch.channelName ?? "HkTube Creator",
    channelHandle: patch.channelHandle ?? "creator",
    audioUrl: patch.audioUrl ?? `https://example.test/${Math.random()}.mp4`,
    thumbnailUrl: patch.thumbnailUrl ?? null,
    durationSeconds: patch.durationSeconds ?? 30,
    isShort: patch.isShort ?? false,
  };
}

describe("soundLabel", () => {
  it("reads like the label under a sound", () => {
    expect(soundLabel(sound({ title: "Night drive", channelName: "Ayesha" }))).toBe("Night drive · Ayesha");
  });

  it("falls back instead of printing an empty row", () => {
    expect(soundLabel(sound({ title: "   ", channelName: "Ayesha" }))).toBe("Original sound · Ayesha");
    expect(soundLabel(sound({ title: "Night drive", channelName: "  " }))).toBe("Night drive");
  });
});

describe("normalizeSoundQuery", () => {
  it("accepts the ways a creator types a search", () => {
    expect(normalizeSoundQuery("  @Ayesha  ")).toBe("ayesha");
    expect(normalizeSoundQuery("Night   Drive")).toBe("night drive");
    expect(normalizeSoundQuery("@@@loop")).toBe("loop");
  });

  it("turns an empty box into an empty query", () => {
    expect(normalizeSoundQuery("   ")).toBe("");
    expect(normalizeSoundQuery("")).toBe("");
  });
});

describe("filterSounds", () => {
  const library = [
    sound({ id: "a", title: "Night drive", channelName: "Ayesha", audioUrl: "u-a" }),
    sound({ id: "b", title: "Morning loop", channelName: "Bilal", audioUrl: "u-b" }),
    sound({ id: "c", title: "City rain", channelName: "Ayesha", audioUrl: "u-c" }),
  ];

  it("returns everything for an empty search", () => {
    expect(filterSounds(library, "").map(row => row.id)).toEqual(["a", "b", "c"]);
  });

  it("matches the sound title without caring about case", () => {
    expect(filterSounds(library, "NIGHT").map(row => row.id)).toEqual(["a"]);
  });

  it("matches the channel too, so a creator's sounds are findable", () => {
    expect(filterSounds(library, "ayesha").map(row => row.id)).toEqual(["a", "c"]);
    expect(filterSounds(library, "@ayesha").map(row => row.id)).toEqual(["a", "c"]);
  });

  it("returns nothing rather than everything when nothing matches", () => {
    expect(filterSounds(library, "zzz")).toEqual([]);
  });

  it("shows one row per sound even when several videos share it", () => {
    const duplicated = [
      sound({ id: "one", title: "Same", audioUrl: "shared" }),
      sound({ id: "two", title: "Same", audioUrl: "shared" }),
      sound({ id: "three", title: "Other", audioUrl: "other" }),
    ];
    expect(filterSounds(duplicated, "").map(row => row.id)).toEqual(["one", "three"]);
  });

  it("caps how many rows the sheet has to render", () => {
    const many = Array.from({ length: 60 }, (_, index) =>
      sound({ id: `s${index}`, title: `Track ${index}`, audioUrl: `u${index}` })
    );
    expect(filterSounds(many, "").length).toBe(SOUND_PAGE_SIZE);
    expect(filterSounds(many, "", 5).length).toBe(5);
  });
});
