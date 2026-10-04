import { describe, expect, it } from "vitest";
import { decideSupervisorAction } from "./platformSupervisor";

describe("HkTube autonomous supervisor policy gate", () => {
  it("blocks all automation when the emergency kill-switch is enabled", () => {
    expect(decideSupervisorAction({ eventType: "video.enforcement", confidence: 100, destructive: true, providerReady: true, killSwitchEnabled: true })).toEqual({ decision: "block", reason: "Automation kill-switch is enabled." });
  });

  it("never claims success when a required provider is unavailable", () => {
    expect(decideSupervisorAction({ eventType: "video.transcription", confidence: 100, providerReady: false }).decision).toBe("degraded");
  });

  it("routes destructive low-confidence decisions to review", () => {
    expect(decideSupervisorAction({ eventType: "copyright.match", confidence: 94, destructive: true, providerReady: true }).decision).toBe("review");
  });

  it("allows high-confidence ready non-destructive work", () => {
    expect(decideSupervisorAction({ eventType: "metadata.generate", confidence: 90, providerReady: true }).decision).toBe("execute");
  });
});
