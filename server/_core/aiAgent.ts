import { invokeLLM, type InvokeResult, type Message, type Tool } from "./llm";
import { searchWeb, type AIWebSource } from "./aiKnowledge";
import { readGmailThread, searchGmail } from "./gmail";

const WEB_SEARCH_TOOL: Tool = {
  type: "function",
  function: {
    name: "web_search",
    description: "Search the public web when the user asks for current, official, researched, comparative, or source-backed information. Do not search for secrets or private data.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "A focused public web search query, maximum 240 characters." } },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

const GMAIL_SEARCH_TOOL: Tool = {
  type: "function",
  function: {
    name: "gmail_search",
    description: "Search the owner's connected Gmail inbox for new, unread, important, or matching emails.",
    parameters: { type: "object", properties: { query: { type: "string" }, maxResults: { type: "number" } }, required: ["query"], additionalProperties: false },
  },
};
const GMAIL_THREAD_TOOL: Tool = {
  type: "function",
  function: {
    name: "gmail_read_thread",
    description: "Read a connected Gmail thread after a Gmail search returned its thread ID.",
    parameters: { type: "object", properties: { threadId: { type: "string" } }, required: ["threadId"], additionalProperties: false },
  },
};
const AGENT_TOOLS = [WEB_SEARCH_TOOL, GMAIL_SEARCH_TOOL, GMAIL_THREAD_TOOL];
const MAX_TOOL_CALLS = 4;

type ToolCall = NonNullable<NonNullable<InvokeResult["choices"][number]["message"]>["tool_calls"]>[number];

function getToolCalls(result: InvokeResult): ToolCall[] {
  const calls = result.choices[0]?.message?.tool_calls;
  return Array.isArray(calls) ? calls.slice(0, MAX_TOOL_CALLS) : [];
}

function parseSearchQuery(call: ToolCall): string | null {
  if (call.function?.name !== "web_search") return null;
  try {
    const args = JSON.parse(call.function.arguments) as { query?: unknown };
    return typeof args.query === "string" ? args.query.trim().slice(0, 240) : null;
  } catch {
    return null;
  }
}

function parseToolArguments(call: ToolCall): Record<string, unknown> | null {
  try { const value = JSON.parse(call.function.arguments); return value && typeof value === "object" ? value as Record<string, unknown> : null; } catch { return null; }
}

export async function runBoundedAIAgent(input: {
  messages: Message[];
  systemInstruction: string;
  initialSources?: AIWebSource[];
  signal?: AbortSignal;
  timeoutMs?: number;
  finalResponseFormat?: Parameters<typeof invokeLLM>[0]["responseFormat"];
  gmailAccessToken?: string;
  ownerEmail?: string;
}): Promise<{ result: InvokeResult; sources: AIWebSource[]; toolCallsUsed: number }> {
  const sources = [...(input.initialSources ?? [])];
  const agentMessages: Message[] = [
    { role: "system", content: `${input.systemInstruction}\n\nYou are operating in bounded agent mode. For task requests, reason about the goal, use web_search when current or source-backed information is needed, and use Gmail tools when the user asks about their connected inbox. If Gmail access is unavailable, explain the connection requirement; do not silently refuse. Verify tool results before answering. You may only use the tools explicitly provided. Never claim to have changed files, accounts, deployments, or external data.` },
    ...input.messages,
  ];

  const first = await invokeLLM({
    messages: agentMessages,
    tools: AGENT_TOOLS,
    toolChoice: "auto",
    maxTokens: 1400,
    timeoutMs: input.timeoutMs,
    maxRetries: 0,
    signal: input.signal,
  });
  const calls = getToolCalls(first);
  if (!calls.length) return { result: first, sources, toolCallsUsed: 0, toolNames: [] as string[] };

  agentMessages.push({ role: "assistant", content: first.choices[0]?.message?.content || "", tool_calls: calls });
  for (const call of calls) {
    const query = parseSearchQuery(call);
    const args = parseToolArguments(call);
    if (query) {
      const found = await searchWeb(query, input.signal);
      sources.push(...found);
      agentMessages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ query, sources: found }) });
      continue;
    }
    if (call.function?.name === "gmail_search") {
      const gmailQuery = typeof args?.query === "string" ? args.query.trim().slice(0, 500) : "in:inbox newer_than:1d";
      const maxResults = typeof args?.maxResults === "number" ? Math.min(Math.max(Math.floor(args.maxResults), 1), 20) : 10;
      const result = input.gmailAccessToken ? await searchGmail(input.gmailAccessToken, gmailQuery, maxResults, input.signal) : { error: "Gmail is not connected in this HkTube session. Use Connect Gmail first." };
      agentMessages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ query: gmailQuery, result }) });
      continue;
    }
    if (call.function?.name === "gmail_read_thread") {
      const threadId = typeof args?.threadId === "string" ? args.threadId.trim() : "";
      const result = input.gmailAccessToken && threadId ? await readGmailThread(input.gmailAccessToken, threadId, input.signal) : { error: "Gmail thread access is not available. Connect Gmail first." };
      agentMessages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ threadId, result }) });
      continue;
    }
    agentMessages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "Unsupported tool call" }) });
  }

  const final = await invokeLLM({
    messages: agentMessages,
    maxTokens: 2200,
    timeoutMs: input.timeoutMs,
    maxRetries: 0,
    signal: input.signal,
    responseFormat: input.finalResponseFormat,
  });
  const toolNames = calls.map(call => typeof call.function?.name === "string" ? call.function.name : "unknown");\n  return { result: final, sources, toolCallsUsed: calls.length, toolNames };
}

export const __agentInternals = { AGENT_TOOLS, MAX_TOOL_CALLS, parseSearchQuery };
