export type AIChatOutput = {
  answer: string;
  memories: Array<{ memory_type: string; memory_key: string; value: unknown }>;
};

export class AIEmptyResponseError extends Error {
  readonly code = "AI_EMPTY_RESPONSE";
  constructor() {
    super("AI ne koi response nahi diya, dobara try karein.");
    this.name = "AIEmptyResponseError";
  }
}

/** Validate the upstream envelope, normalize text parts, and tolerate plain-text fallbacks. */
export function parseAIChatOutput(response: unknown): AIChatOutput {
  if (!response || typeof response !== "object") throw new AIEmptyResponseError();
  const choices = (response as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices.length || !choices[0] || typeof choices[0] !== "object") {
    throw new AIEmptyResponseError();
  }
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== "object") throw new AIEmptyResponseError();
  const content = (message as { content?: unknown }).content;
  const text = typeof content === "string"
    ? content.trim()
    : Array.isArray(content)
      ? content.map(part => part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : "").join("").trim()
      : "";
  if (!text) throw new AIEmptyResponseError();

  let decoded: unknown = text;
  try { decoded = JSON.parse(text); }
  catch {
    // Some otherwise healthy providers ignore the requested JSON format. The
    // user-facing answer is still useful; do not turn readable text into a blank error.
    return { answer: text, memories: [] };
  }
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    return { answer: text, memories: [] };
  }
  const candidate = decoded as { answer?: unknown; memories?: unknown };
  if (typeof candidate.answer !== "string" || !candidate.answer.trim()) throw new AIEmptyResponseError();
  const memories = Array.isArray(candidate.memories)
    ? candidate.memories.filter((item): item is { memory_type: string; memory_key: string; value: unknown } => {
      if (!item || typeof item !== "object") return false;
      const entry = item as Record<string, unknown>;
      return typeof entry.memory_type === "string" && !!entry.memory_type.trim()
        && typeof entry.memory_key === "string" && !!entry.memory_key.trim()
        && Object.prototype.hasOwnProperty.call(entry, "value");
    }).slice(0, 5)
    : [];
  return { answer: candidate.answer.trim(), memories };
}

export type AIErrorCategory = "configuration" | "authentication" | "rate_limit" | "timeout" | "empty_response" | "network" | "upstream";
export type AIErrorPresentation = { category: AIErrorCategory; status: number; message: string };

export function presentAIError(error: unknown): AIErrorPresentation {
  const candidate = error && typeof error === "object" ? error as { message?: unknown; name?: unknown; status?: unknown; code?: unknown } : {};
  const raw = typeof candidate.message === "string" ? candidate.message : "";
  const status = typeof candidate.status === "number" ? candidate.status : undefined;
  if (candidate.code === "AI_EMPTY_RESPONSE" || /empty answer|no usable response/i.test(raw)) {
    return { category: "empty_response", status: 502, message: "AI ne koi response nahi diya, dobara try karein." };
  }
  if (/OPENAI_API_KEY|GEMINI_API_KEY|BUILT_IN_FORGE_API_KEY|not configured/i.test(raw)) {
    return { category: "configuration", status: 503, message: "HkTube AI server par configure nahi hai. Thori dair baad dobara try karein." };
  }
  if (status === 401 || status === 403 || /invalid api key|unauthorized|authentication failed/i.test(raw)) {
    return { category: "authentication", status: 503, message: "HkTube AI provider credentials mein masla hai. Support team ko inform karein." };
  }
  if (status === 429 || /429|rate limit|quota/i.test(raw)) {
    return { category: "rate_limit", status: 429, message: "HkTube AI abhi busy hai. Kuch dair baad dobara try karein." };
  }
  if (candidate.name === "TimeoutError" || candidate.name === "AbortError" || /timeout|timed out|aborted/i.test(raw)) {
    return { category: "timeout", status: 504, message: "HkTube AI ko jawab dene mein zyada waqt laga. Chhota sawal bhej kar dobara try karein." };
  }
  if (candidate.name === "TypeError" || /fetch failed|network|socket/i.test(raw)) {
    return { category: "network", status: 503, message: "Network connection ka masla hai. Internet check karke dobara try karein." };
  }
  return { category: "upstream", status: 502, message: "HkTube AI temporarily unavailable hai. Dobara try karein." };
}
