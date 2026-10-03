import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("LLM provider response guardrails", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", "test-provider-key");
    vi.stubEnv("OPENAI_BASE_URL", "");
    vi.stubEnv("OPENAI_MODEL", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("preserves a provider 429 status without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "quota exceeded" } }), { status: 429, statusText: "Too Many Requests" }));
    vi.stubGlobal("fetch", fetchMock);
    const { invokeLLM } = await import("./llm");
    await expect(invokeLLM({ messages: [{ role: "user", content: "hi" }] })).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects non-JSON and invalid-envelope success responses", async () => {
    const { invokeLLM } = await import("./llm");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not-json", { status: 200 })));
    await expect(invokeLLM({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow("invalid JSON response");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ unexpected: true }), { status: 200 })));
    await expect(invokeLLM({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow("invalid response envelope");
  });

  it("retries one transient Gemini 503 before falling back within the shared deadline", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-3.8-flash");
    vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");
    const fallbackResponse = {
      id: "fallback-response",
      model: "gpt-4o-mini",
      choices: [{ index: 0, message: { role: "assistant", content: "OpenAI fallback answer" }, finish_reason: "stop" }],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "temporarily unavailable" } }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "temporarily unavailable" } }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(fallbackResponse), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    const result = await invokeLLM({ messages: [{ role: "user", content: "hi" }], timeoutMs: 5_000, maxRetries: 0 });

    expect(result.choices[0]?.message.content).toBe("OpenAI fallback answer");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("generativelanguage.googleapis.com");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("generativelanguage.googleapis.com");
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("api.openai.com/v1/chat/completions");
    const fallbackInit = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(new Headers(fallbackInit.headers).get("authorization")).toBe("Bearer test-provider-key");
    expect(JSON.parse(String(fallbackInit.body)).model).toBe("gpt-4o-mini");
  });

  it("records both provider statuses when Gemini and the OpenAI fallback are unavailable", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-3.8-flash");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { type: "insufficient_quota", code: "credit_balance_exhausted" } }), { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const failureLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const { invokeLLM } = await import("./llm");
    await expect(invokeLLM({ messages: [{ role: "user", content: "hi" }], timeoutMs: 5_000, maxRetries: 0 }))
      .rejects.toMatchObject({ status: 429, providerFailures: {
        primary: { provider: "gemini", status: 503, kind: "http" },
        fallback: { provider: "openai", status: 429 },
      } });
    expect(failureLog).toHaveBeenCalledWith("[LLM] Gemini and OpenAI providers both failed", {
      primary: { provider: "gemini", status: 503, kind: "http" },
      fallback: { provider: "openai", status: 429 },
    });
  });

  it("does not use failover for deterministic Gemini 4xx errors", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "invalid request" } }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    await expect(invokeLLM({ messages: [{ role: "user", content: "hi" }] })).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
