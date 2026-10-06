import { invokeLLM, type InvokeResult, type Message, type Tool } from "./llm";
import { searchWeb, type AIWebSource } from "./aiKnowledge";

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

const AGENT_TOOLS = [WEB_SEARCH_TOOL];
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

export async function runBoundedAIAgent(input: {
  messages: Message[];
  systemInstruction: string;
  initialSources?: AIWebSource[];
  signal?: AbortSignal;
  timeoutMs?: number;
  finalResponseFormat?: Parameters<typeof invokeLLM>[0]["responseFormat"];
}): Promise<{ result: InvokeResult; sources: AIWebSource[]; toolCallsUsed: number }> {
  const sources = [...(input.initialSources ?? [])];
  const agentMessages: Message[] = [
    { role: "system", content: `${input.systemInstruction}\n\nYou are operating in bounded agent mode. For task requests, reason about the goal, use web_search when current or source-backed information is needed, then verify the findings before answering. You may only use the tools explicitly provided. Never claim to have changed files, accounts, deployments, or external data.` },
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
  if (!calls.length) return { result: first, sources, toolCallsUsed: 0 };

  agentMessages.push({ role: "assistant", content: first.choices[0]?.message?.content || "", tool_calls: calls });
  for (const call of calls) {
    const query = parseSearchQuery(call);
    const found = query ? await searchWeb(query, input.signal) : [];
    sources.push(...found);
    agentMessages.push({
      role: "tool",
      tool_call_id: call.id,
      content: JSON.stringify({ query, sources: found }),
    });
  }

  const final = await invokeLLM({
    messages: agentMessages,
    maxTokens: 2200,
    timeoutMs: input.timeoutMs,
    maxRetries: 0,
    signal: input.signal,
    responseFormat: input.finalResponseFormat,
  });
  return { result: final, sources, toolCallsUsed: calls.length };
}

export const __agentInternals = { AGENT_TOOLS, MAX_TOOL_CALLS, parseSearchQuery };
