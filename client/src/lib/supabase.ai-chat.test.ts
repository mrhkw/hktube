import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestAIChat, supabase } from "./supabase";

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
