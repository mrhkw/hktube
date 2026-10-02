import { afterEach, describe, expect, it, vi } from "vitest";
import { getAIUserId } from "./aiKnowledge";

afterEach(() => vi.unstubAllGlobals());

describe("AI chat Supabase session verification", () => {
  it("requires a bearer token and does not trust a client-supplied user id", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await getAIUserId({ headers: {} })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("verifies a bearer token with Supabase Auth and returns the verified subject", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "verified-supabase-user", email: "owner@gmail.com" }) });
    vi.stubGlobal("fetch", fetchSpy);
    const req = { headers: { authorization: "Bearer valid-session-token" } };

    await expect(getAIUserId(req)).resolves.toBe("verified-supabase-user");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/auth\/v1\/user$/);
    expect(new Headers(options.headers).get("Authorization")).toBe("Bearer valid-session-token");
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("rejects revoked or expired tokens", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    await expect(getAIUserId({ headers: { authorization: "Bearer expired-token" } })).resolves.toBeNull();
  });
});
