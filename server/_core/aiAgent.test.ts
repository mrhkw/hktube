import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeLLMMock = vi.fn();
const searchWebMock = vi.fn();
vi.mock("./llm", async () => {
  const actual = await vi.importActual<typeof import("./llm")>("./llm");
  return { ...actual, invokeLLM: invokeLLMMock };
});
vi.mock("./aiKnowledge", () => ({ searchWeb: searchWebMock }));

describe("bounded HkTube agent", () => {
  beforeEach(() => {
    invokeLLMMock.mockReset();
    searchWebMock.mockReset();
    searchWebMock.mockResolvedValue([{ title: "Official result", url: "https://example.com", snippet: "Verified detail" }]);
  });

  it("executes a web-search tool call and sends the result back for final verification", async () => {
    invokeLLMMock
      .mockResolvedValueOnce({ choices: [{ message: { role: "assistant", content: "", tool_calls: [{ id: "call-1", type: "function", function: { name: "web_search", arguments: JSON.stringify({ query: "official HkTube update" }) } }] } }] })
      .mockResolvedValueOnce({ model: "openai/gpt-oss-20b", choices: [{ message: { role: "assistant", content: JSON.stringify({ answer: "Verified answer", memories: [] }) } }] });

    const { runBoundedAIAgent } = await import("./aiAgent");
    const result = await runBoundedAIAgent({
      messages: [{ role: "user", content: "Research the latest official HkTube update." }],
      systemInstruction: "Be accurate.",
      finalResponseFormat: { type: "json_object" },
    });

    expect(searchWebMock).toHaveBeenCalledWith("official HkTube update", undefined);
    expect(result.toolCallsUsed).toBe(1);
    expect(result.sources[0]?.title).toBe("Official result");
    expect(invokeLLMMock).toHaveBeenCalledTimes(2);
    const finalMessages = invokeLLMMock.mock.calls[1][0].messages;
    expect(finalMessages.at(-1)).toMatchObject({ role: "tool", tool_call_id: "call-1" });
    expect(result.result.choices[0]?.message.content).toContain("Verified answer");
  });

  it("does not call tools when Groq returns a direct answer", async () => {
    invokeLLMMock.mockResolvedValueOnce({ model: "openai/gpt-oss-20b", choices: [{ message: { role: "assistant", content: "Direct answer" } }] });
    const { runBoundedAIAgent } = await import("./aiAgent");
    const result = await runBoundedAIAgent({ messages: [{ role: "user", content: "Hello" }], systemInstruction: "Be helpful." });
    expect(result.toolCallsUsed).toBe(0);
    expect(searchWebMock).not.toHaveBeenCalled();
    expect(result.result.choices[0]?.message.content).toBe("Direct answer");
  });
  it("supports multiple bounded tool rounds before returning a final answer", async () => {
    invokeLLMMock
      .mockResolvedValueOnce({ choices: [{ message: { role: "assistant", content: "", tool_calls: [{ id: "call-1", type: "function", function: { name: "web_search", arguments: JSON.stringify({ query: "first query" }) } }] } }] })
      .mockResolvedValueOnce({ choices: [{ message: { role: "assistant", content: "", tool_calls: [{ id: "call-2", type: "function", function: { name: "web_search", arguments: JSON.stringify({ query: "follow-up query" }) } }] } }] })
      .mockResolvedValueOnce({ model: "openai/gpt-oss-20b", choices: [{ message: { role: "assistant", content: JSON.stringify({ answer: "Final verified answer", memories: [] }) } }] });

    const { runBoundedAIAgent } = await import("./aiAgent");
    const result = await runBoundedAIAgent({
      messages: [{ role: "user", content: "Research and verify this topic." }],
      systemInstruction: "Be accurate.",
      finalResponseFormat: { type: "json_object" },
    });

    expect(searchWebMock).toHaveBeenCalledTimes(2);
    expect(invokeLLMMock).toHaveBeenCalledTimes(3);
    expect(result.toolCallsUsed).toBe(2);
    expect(result.toolNames).toEqual(["web_search", "web_search"]);
    expect(result.result.choices[0]?.message.content).toContain("Final verified answer");
  });

});
