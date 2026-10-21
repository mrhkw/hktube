import { describe, expect, it } from "vitest";
import { normalizeHkTubeAppearance, resolveHkTubeAppearance } from "./appearance";

describe("HkTube appearance preference", () => {
  it("defaults invalid and removed palette preferences to System", () => {
    expect(normalizeHkTubeAppearance(null)).toBe("system");
    expect(normalizeHkTubeAppearance("violet")).toBe("system");
    expect(normalizeHkTubeAppearance("ocean-blue")).toBe("system");
  });

  it("keeps the only two explicit appearances", () => {
    expect(normalizeHkTubeAppearance("light")).toBe("light");
    expect(normalizeHkTubeAppearance("dark")).toBe("dark");
  });

  it("migrates old automatic and AMOLED choices without exposing extra themes", () => {
    expect(normalizeHkTubeAppearance("auto")).toBe("system");
    expect(normalizeHkTubeAppearance("amoled")).toBe("dark");
  });

  it("follows the operating system only while System is selected", () => {
    expect(resolveHkTubeAppearance("system", false)).toBe("light");
    expect(resolveHkTubeAppearance("system", true)).toBe("dark");
    expect(resolveHkTubeAppearance("light", true)).toBe("light");
    expect(resolveHkTubeAppearance("dark", false)).toBe("dark");
  });
});
