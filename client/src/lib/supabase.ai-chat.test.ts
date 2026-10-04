import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestAdminAgentChat, requestAIChat, supabase } from "./supabase";

const installSession = () => {
  vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
    data: {
      session: {
        access_token: "test-session-token",
        expires_at: Math.floor(Date.now() / 1000) + 3_600,
      },
    } as any,
    error: null,
  } as any);
};

const directPayload = (content: string) => ({
  content,
  sources: [],
  usedWeb: false,
  model: "gemini-3.8-flash",
});

beforeEach(() => {
  installSession();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("HkTube AI client response parsing", () => {
  it("accepts the direct JSON object returned by the production endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(directPayload("Direct response works")), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAIChat([{ role: "user", content: "hi" }]);

    expect(result.content).toBe("Direct response works");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends the current Supabase bearer token to the direct AI endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(directPayload("Authenticated response works")), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await requestAIChat([{ role: "user", content: "hi" }]);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/ai/chat");
    expect(fetchMock.mock.calls[0][1].credentials).toBe("omit");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer test-session-token");
  });

  it("refreshes an expired Supabase token once after a 401", async () => {
    vi.spyOn(supabase.auth, "refreshSession").mockResolvedValue({
      data: { session: { access_token: "refreshed-session-token", expires_at: Math.floor(Date.now() / 1000) + 3_600 } },
      error: null,
    } as any);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "expired" } }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(directPayload("Refreshed response works")), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAIChat([{ role: "user", content: "hi" }]);

    expect(result.content).toBe("Refreshed response works");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer refreshed-session-token");
  });

  it("remains compatible with a tRPC-wrapped response envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: { data: { json: directPayload("Wrapped response works") } } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAIChat([{ role: "user", content: "hi" }]);

    expect(result.content).toBe("Wrapped response works");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries an empty model payload once and then returns a friendly error", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(directPayload("   ")), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(directPayload("")), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestAIChat([{ role: "user", content: "hi" }]))
      .rejects.toThrow("AI ne koi response nahi diya, dobara try karein.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("private Admin Agent transport", () => {
  it("sends a bearer-authenticated request only to the dedicated admin endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: "Reviewable patch advice", model: "gemini-2.5-flash" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAdminAgentChat([{ role: "user", content: "Help review a code change." }]);

    expect(result.content).toBe("Reviewable patch advice");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin-agent/chat");
    expect(fetchMock.mock.calls[0][1].credentials).toBe("omit");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer test-session-token");
  });
});
