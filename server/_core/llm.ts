import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  model?: string;
  thinking?: Record<string, unknown>;
  reasoning?: Record<string, unknown>;
  /** Optional caller-owned deadline (for example the Vercel request budget). */
  signal?: AbortSignal;
  /** Per-invocation ceiling; retries share this same time budget. */
  timeoutMs?: number;
  /** Override the default bounded retry count for latency-sensitive routes. */
  maxRetries?: number;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id, tool_calls } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      ...(tool_calls ? { tool_calls } : {}),
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    ...(tool_calls ? { tool_calls } : {}),
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

type LLMProvider = "groq" | "gemini" | "openai" | "forge";

// Groq's free GPT-OSS endpoint is preferred when its key is configured. Keep
// Gemini as a free-provider fallback, then preserve the existing Gemini/OpenAI
// selection for deployments that have not opted into Groq.
const resolvePrimaryProvider = (): LLMProvider => {
  if (ENV.groqApiKey.trim()) return "groq";
  if (ENV.geminiApiKey.trim()) return "gemini";
  if (ENV.openAiApiKey.trim()) return "openai";
  return "forge";
};

const resolveProviderConfig = (provider: LLMProvider) => {
  if (provider === "groq") return {
    url: "https://api.groq.com/openai/v1/chat/completions",
    modelsUrl: "https://api.groq.com/openai/v1/models",
    key: ENV.groqApiKey.trim(),
    model: ENV.groqModel,
  };
  if (provider === "gemini") return {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    modelsUrl: "https://generativelanguage.googleapis.com/v1beta/openai/models",
    key: ENV.geminiApiKey.trim(),
    model: ENV.geminiModel,
  };
  if (provider === "openai") return {
    url: `${ENV.openAiBaseUrl.replace(/\/$/, "")}/chat/completions`,
    modelsUrl: `${ENV.openAiBaseUrl.replace(/\/$/, "")}/models`,
    key: ENV.openAiApiKey.trim(),
    model: ENV.openAiModel,
  };
  const baseUrl = ENV.forgeApiUrl.trim() || "https://forge.manus.im";
  return {
    url: `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`,
    modelsUrl: `${baseUrl.replace(/\/$/, "")}/v1/models`,
    key: ENV.forgeApiKey,
    model: "",
  };
};

const resolveApiKey = () => resolveProviderConfig(resolvePrimaryProvider()).key;
const providerDisplayName = (provider: LLMProvider) => provider === "openai" ? "OpenAI" : provider === "groq" ? "Groq" : provider === "gemini" ? "Gemini" : "Forge";
const resolveFallbackProvider = (primary: LLMProvider): LLMProvider | undefined => {
  if (primary === "groq" && ENV.geminiApiKey.trim()) return "gemini";
  if (primary === "gemini" && ENV.openAiApiKey.trim()) return "openai";
  return undefined;
};

const assertApiKey = () => {
  if (!resolveApiKey()) {
    throw new Error("GROQ_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, or BUILT_IN_FORGE_API_KEY is not configured");
  }
};

// A provider-side 429 can mean temporary throttling or exhausted quota for
// this key/model. If another provider is configured, try it rather than
// immediately telling the user to wait and retry the same failing provider.
const isFallbackStatus = (status: number) => status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
const isProviderTransportFailure = (error: unknown) =>
  error instanceof Error && ["AbortError", "TimeoutError", "TypeError"].includes(error.name);

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

const RETRY_MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 30_000;
const INVOKE_TIMEOUT_MS = 20_000;
const INVOKE_BUDGET_MS = 24_000;

type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const finish = () => { signal?.removeEventListener("abort", abort); resolve(); };
    const timer = setTimeout(finish, ms);
    const abort = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(signal?.reason ?? new DOMException("LLM request aborted", "AbortError")); };
    signal?.addEventListener("abort", abort, { once: true });
  });

const parseRetryAfter = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
};

// Equal-jitter exponential backoff. The cap/2 floor guarantees a minimum
// delay so a misbehaving caller loop slows down instead of hammering the
// upstream while it keeps returning errors.
const computeBackoffDelay = (
  attempt: number,
  retryAfterMs?: number
): number => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};

// Retries non-2xx responses and network errors with exponential backoff, then
// returns the final Response so callers keep their existing error handling.
const fetchWithBackoff = async (
  url: string,
  init: FetchInit,
  options: { timeoutMs?: number; maxRetries?: number; signal?: AbortSignal } = {}
): Promise<Response> => {
  let lastError: unknown;
  const startedAt = Date.now();
  const budgetMs = Math.max(1, options.timeoutMs ?? INVOKE_BUDGET_MS);
  const maxRetries = Math.max(0, options.maxRetries ?? RETRY_MAX_RETRIES);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const remaining = budgetMs - (Date.now() - startedAt);
    if (remaining <= 0 || options.signal?.aborted) {
      throw options.signal?.reason ?? new DOMException("LLM request deadline exceeded", "TimeoutError");
    }
    const perAttempt = Math.min(INVOKE_TIMEOUT_MS, remaining);
    const timeoutSignal = AbortSignal.timeout(perAttempt);
    const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;
    try {
      const response = await fetch(url, { ...init, signal });
      // A 429 is a provider quota/rate-limit decision; retrying immediately
      // only burns more requests and cannot repair the configured key.
      const permanentClientError = response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 425;
      if (response.ok || permanentClientError || attempt === maxRetries) {
        return response;
      }

      const retryAfterMs = parseRetryAfter(
        response.headers.get("retry-after")
      );
      try {
        await response.body?.cancel();
      } catch {
        // Body already settled; nothing to clean up.
      }
      console.warn(
        `LLM request retry ${attempt + 1}/${maxRetries} after status ${response.status}`
      );
      const delay = Math.min(computeBackoffDelay(attempt, retryAfterMs), Math.max(0, budgetMs - (Date.now() - startedAt)));
      if (delay > 0) await sleep(delay, options.signal);
    } catch (error) {
      lastError = error;
      if (options.signal?.aborted || attempt === maxRetries) throw error;
      console.warn(
        `LLM request retry ${attempt + 1}/${maxRetries} after network error`
      );
      const delay = Math.min(computeBackoffDelay(attempt), Math.max(0, budgetMs - (Date.now() - startedAt)));
      if (delay > 0) await sleep(delay, options.signal);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("LLM request failed after exhausting retries");
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    thinking,
    reasoning,
    maxTokens,
    max_tokens,
    signal,
    timeoutMs,
    maxRetries,
  } = params;

  const payload: Record<string, unknown> = {
    messages: messages.map(normalizeMessage),
  };

  if (model) {
    payload.model = model;
  } else {
    const defaultModel = resolveProviderConfig(resolvePrimaryProvider()).model;
    if (defaultModel) payload.model = defaultModel;
  }

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }

  if (thinking) {
    payload.thinking = thinking;
  }
  if (reasoning) {
    payload.reasoning = reasoning;
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const invocationStartedAt = Date.now();
  const invocationBudgetMs = Math.max(1, timeoutMs ?? INVOKE_BUDGET_MS);
  const invocationTimeout = AbortSignal.timeout(invocationBudgetMs);
  const invocationSignal = signal
    ? AbortSignal.any([signal, invocationTimeout])
    : invocationTimeout;
  const remainingBudgetMs = () => Math.max(1, invocationBudgetMs - (Date.now() - invocationStartedAt));
  const primaryProvider = resolvePrimaryProvider();
  const fallbackProvider = resolveFallbackProvider(primaryProvider);
  const canFailOver = Boolean(fallbackProvider);
  let primaryFailureDetails: { status?: number; kind: string } | undefined;
  const tryFallback = () => {
    if (!fallbackProvider) throw new Error("No fallback LLM provider is configured");
    const fallbackConfig = resolveProviderConfig(fallbackProvider);
    const fallbackPayload: Record<string, unknown> = { ...payload };
    if (fallbackConfig.model) fallbackPayload.model = fallbackConfig.model;
    delete fallbackPayload.thinking;
    delete fallbackPayload.reasoning;
    console.warn(`[LLM] ${providerDisplayName(primaryProvider)} failed; trying configured ${providerDisplayName(fallbackProvider)} fallback`, {
      primaryStatus: primaryFailureDetails?.status ?? null,
      primaryFailure: primaryFailureDetails?.kind ?? "unknown",
    });
    return fetchWithBackoff(fallbackConfig.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${fallbackConfig.key}`,
      },
      body: JSON.stringify(fallbackPayload),
    }, { timeoutMs: remainingBudgetMs(), maxRetries: 0, signal: invocationSignal });
  };

  let response: Response;
  try {
    // Reserve part of the invocation budget for failover instead of spending
    // the full timeout retrying a degraded primary provider.
    const primaryBudgetMs = canFailOver
      ? Math.min(10_000, Math.max(1, Math.floor(invocationBudgetMs / 2)))
      : remainingBudgetMs();
    const primaryConfig = resolveProviderConfig(primaryProvider);
    response = await fetchWithBackoff(primaryConfig.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${primaryConfig.key}`,
      },
      body: JSON.stringify(payload),
    }, { timeoutMs: primaryBudgetMs, maxRetries: canFailOver ? 1 : maxRetries, signal: invocationSignal });
  } catch (error) {
    if (!canFailOver || invocationSignal.aborted || !isProviderTransportFailure(error)) throw error;
    primaryFailureDetails = { kind: error instanceof Error ? error.name : "UnknownError" };
    response = await tryFallback();
  }

  if (canFailOver && !response.ok && isFallbackStatus(response.status) && !invocationSignal.aborted) {
    primaryFailureDetails = { kind: "http", status: response.status };
    try { await response.body?.cancel(); } catch { /* best-effort release of the failed provider response */ }
    response = await tryFallback();
  }

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`) as Error & {
      status: number;
      providerFailures?: {
        primary: { provider: LLMProvider; status?: number; kind: string };
        fallback: { provider: LLMProvider; status: number };
      };
    };
    error.status = response.status;
    if (primaryFailureDetails) {
      error.providerFailures = {
        primary: { provider: primaryProvider, ...primaryFailureDetails },
        fallback: { provider: fallbackProvider!, status: response.status },
      };
      console.error(`[LLM] ${providerDisplayName(primaryProvider)} and ${providerDisplayName(fallbackProvider!)} providers both failed`, error.providerFailures);
    }
    throw error;
  }

  let data: unknown;
  try { data = await response.json(); }
  catch { throw new Error("LLM provider returned an invalid JSON response"); }
  if (!data || typeof data !== "object" || !Array.isArray((data as { choices?: unknown }).choices)) {
    throw new Error("LLM provider returned an invalid response envelope");
  }
  return data as InvokeResult;
}

export type ModelInfo = {
  id: string;
  object: string;
  created: number;
  owned_by: string;
};

export type ModelsResponse = {
  object: string;
  data: ModelInfo[];
};

export async function listLLMModels(): Promise<ModelsResponse> {
  assertApiKey();
  const provider = resolveProviderConfig(resolvePrimaryProvider());

  const response = await fetchWithBackoff(provider.modelsUrl, {
    headers: { authorization: `Bearer ${provider.key}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `List LLM models failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as ModelsResponse;
}
