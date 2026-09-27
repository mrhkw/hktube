import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("LLM provider configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_BASE_URL", "");
    vi.stubEnv("OPENAI_MODEL", "");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "");
    vi.stubEnv("BUILT_IN_FORGE_API_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses OPENAI_API_KEY with the OpenAI endpoint and a default model", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    await invokeLLM({ messages: [{ role: "user", content: "hello" }] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((request.headers as Record<string, string>).authorization).toBe(
      "Bearer test-openai-key"
    );
    expect(JSON.parse(String(request.body))).toMatchObject({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "hello" }],
    });
  });

  it("keeps the existing Forge endpoint and key when no OpenAI key is set", async () => {
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "test-forge-key");
    vi.stubEnv("BUILT_IN_FORGE_API_URL", "https://forge.example");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    await invokeLLM({ messages: [{ role: "user", content: "hello" }] });

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://forge.example/v1/chat/completions");
    expect((request.headers as Record<string, string>).authorization).toBe(
      "Bearer test-forge-key"
    );
    expect(JSON.parse(String(request.body))).not.toHaveProperty("model");
  });
});
