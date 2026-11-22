import { describe, expect, it } from "vitest";
import { normalizeHkTubeAppearance, resolveHkTubeAppearance } from "./appearance";

describe("HkTube appearance preference", () => {
  it("defaults unknown and legacy palette values to Light", () => {
    expect(normalizeHkTubeAppearance(null)).toBe("light");
    expect(normalizeHkTubeAppearance("system")).toBe("light");
    expect(normalizeHkTubeAppearance("auto")).toBe("light");
    expect(normalizeHkTubeAppearance("violet")).toBe("light");
    expect(normalizeHkTubeAppearance("ocean-blue")).toBe("light");
  });

  it("supports only Light and Dark", () => {
    expect(normalizeHkTubeAppearance("light")).toBe("light");
    expect(normalizeHkTubeAppearance("dark")).toBe("dark");
    expect(normalizeHkTubeAppearance("amoled")).toBe("dark");
  });

  it("does not depend on the operating system appearance", () => {
    expect(resolveHkTubeAppearance("light")).toBe("light");
    expect(resolveHkTubeAppearance("dark")).toBe("dark");
  });
});
