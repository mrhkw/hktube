import { describe, expect, it } from "vitest";
import { validateRuntimeTaskInput } from "./agentRuntimeExecutors";

describe("runtime executor input boundary", () => {
  it("accepts only the known draft and translation task schemas", () => {
    expect(validateRuntimeTaskInput("content-writer", "draft-content", { topic: "Creator safety tips", contentType: "blog" }).ok).toBe(true);
    expect(validateRuntimeTaskInput("translator-voice", "translate-text", { text: "Hello there", targetLanguage: "Roman Urdu" }).ok).toBe(true);
  });

  it("rejects unknown teams/actions and unknown input fields", () => {
    expect(validateRuntimeTaskInput("github-deployer", "push-to-main", { code: "unsafe" })).toMatchObject({ ok: false, code: "UNSUPPORTED_ACTION" });
    expect(validateRuntimeTaskInput("content-writer", "draft-content", { topic: "Valid topic", contentType: "blog", publish: true })).toMatchObject({ ok: false, code: "INVALID_TASK_INPUT" });
  });

  it("rejects secret-like text and invalid sizes before a task can be queued", () => {
    expect(validateRuntimeTaskInput("content-writer", "draft-content", { topic: "api_key=very_secret_value_123", contentType: "blog" })).toMatchObject({ ok: false, code: "INVALID_TASK_INPUT" });
    expect(validateRuntimeTaskInput("translator-voice", "translate-text", { text: "x".repeat(5_001), targetLanguage: "French" })).toMatchObject({ ok: false, code: "INVALID_TASK_INPUT" });
  });
});
