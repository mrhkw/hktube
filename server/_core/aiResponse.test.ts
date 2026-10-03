import { describe, expect, it } from "vitest";
import { AIEmptyResponseError, parseAIChatOutput, presentAIError } from "./aiResponse";

describe("AI response validation", () => {
  it("rejects missing response envelopes and empty assistant content", () => {
    expect(() => parseAIChatOutput(undefined)).toThrow(AIEmptyResponseError);
    expect(() => parseAIChatOutput({ choices: [] })).toThrow(AIEmptyResponseError);
    expect(() => parseAIChatOutput({ choices: [{ message: { content: "  " } }] })).toThrow("AI ne koi response nahi diya");
  });

  it("validates JSON output, ignores malformed memory entries, and normalizes text parts", () => {
    const providerResponse = {
      choices: [{ message: { content: [{
        type: "text",
        text: JSON.stringify({ answer: "  Salam  ", memories: [
          { memory_type: "preference", memory_key: "language", value: "Roman Urdu" },
          { memory_key: "incomplete" },
        ] }),
      }] } }],
    };
    expect(parseAIChatOutput(providerResponse)).toEqual({
      answer: "Salam",
      memories: [{ memory_type: "preference", memory_key: "language", value: "Roman Urdu" }],
    });
  });

  it("uses readable provider text when a provider ignores the JSON format request", () => {
    expect(parseAIChatOutput({ choices: [{ message: { content: "A plain-text but useful answer." } }] })).toEqual({ answer: "A plain-text but useful answer.", memories: [] });
  });

  it("classifies provider failures with safe actionable messages and HTTP statuses", () => {
    expect(presentAIError(Object.assign(new Error("quota exceeded"), { status: 429 }))).toMatchObject({ category: "rate_limit", status: 429 });
    expect(presentAIError(Object.assign(new Error("429 insufficient_quota credit_balance_exhausted"), { status: 429 }))).toMatchObject({
      category: "rate_limit", status: 429, message: "AI provider ke API credits khatam hain. Admin provider account ka quota ya credits check karein.",
    });
    expect(presentAIError(Object.assign(new Error("unauthorized"), { status: 401 }))).toMatchObject({ category: "authentication", status: 503 });
    expect(presentAIError(Object.assign(new Error("socket"), { name: "TimeoutError" }))).toMatchObject({ category: "timeout", status: 504 });
    expect(presentAIError(new AIEmptyResponseError())).toMatchObject({ category: "empty_response", status: 502, message: "AI ne koi response nahi diya, dobara try karein." });
  });
});
