import { describe, expect, it } from "vitest";
import { AI_MODULE_CATALOG } from "./aiModuleCatalog";

describe("safe AI module catalog", () => {
  it("contains exactly 31 uniquely identified manual-approval modules", () => {
    expect(AI_MODULE_CATALOG).toHaveLength(31);
    expect(new Set(AI_MODULE_CATALOG.map(module => module.number)).size).toBe(31);
    expect(new Set(AI_MODULE_CATALOG.map(module => module.id)).size).toBe(31);
    expect(AI_MODULE_CATALOG.every(module => module.approval === "manual" || module.approval === "manual + owner")).toBe(true);
  });
});
