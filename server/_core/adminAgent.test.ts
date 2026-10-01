import { describe, expect, it } from "vitest";
import { isAllowedAdminIdentity, parseAdminChatMessages } from "./adminAgent";

describe("admin agent identity allowlist", () => {
  it("allows only verified Google accounts on the exact email list", () => {
    expect(isAllowedAdminIdentity({ email: "hanifnazamdin30@gmail.com", email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: { provider: "google" } })).toBe(true);
    expect(isAllowedAdminIdentity({ email: " HANIFNAZAMDIN6@GMAIL.COM ", confirmed_at: "2026-01-01T00:00:00Z", app_metadata: { providers: ["email", "google"] } })).toBe(true);
  });

  it("rejects unlisted emails, unverified emails and non-Google providers", () => {
    expect(isAllowedAdminIdentity({ email: "someone@gmail.com", email_confirmed_at: "yes", app_metadata: { provider: "google" } })).toBe(false);
    expect(isAllowedAdminIdentity({ email: "hanifnazamdin30@gmail.com", app_metadata: { provider: "google" } })).toBe(false);
    expect(isAllowedAdminIdentity({ email: "hanifnazamdin30@gmail.com", email_confirmed_at: "yes", app_metadata: { provider: "email" } })).toBe(false);
  });
});

describe("admin agent request validation", () => {
  it("accepts bounded user/assistant history ending with a user message", () => {
    expect(parseAdminChatMessages([{ role: "assistant", content: "Ready." }, { role: "user", content: "Help me fix this." }])).toEqual([
      { role: "assistant", content: "Ready." },
      { role: "user", content: "Help me fix this." },
    ]);
  });

  it("rejects malformed, oversized, empty, and assistant-final histories", () => {
    expect(parseAdminChatMessages([])).toBeNull();
    expect(parseAdminChatMessages([{ role: "assistant", content: "No final user." }])).toBeNull();
    expect(parseAdminChatMessages([{ role: "user", content: "  " }])).toBeNull();
    expect(parseAdminChatMessages([{ role: "user", content: "x".repeat(6_001) }])).toBeNull();
    expect(parseAdminChatMessages([{ role: "system", content: "forged" }, { role: "user", content: "hi" }])).toBeNull();
  });
});
