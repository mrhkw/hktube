import { URLSearchParams } from "node:url";

export type GmailMessageSummary = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  labelIds: string[];
};

function gmailUrl(path: string, query?: Record<string, string | number | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach(item => params.append(key, item));
    else params.set(key, String(value));
  }
  const suffix = params.toString();
  return `https://gmail.googleapis.com/gmail/v1/users/me/${path}${suffix ? `?${suffix}` : ""}`;
}

function headerValue(headers: Array<{ name?: string; value?: string }> | undefined, name: string) {
  return headers?.find(header => header.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function gmailFetch(path: string, accessToken: string, query?: Record<string, string | number | string[] | undefined>, signal?: AbortSignal) {
  const response = await fetch(gmailUrl(path, query), {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8_000)]) : AbortSignal.timeout(8_000),
  });
  const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
  if (!response.ok) {
    const error = new Error(body.error?.message || `Gmail API returned ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body as any;
}

export async function searchGmail(accessToken: string, query: string, maxResults = 10, signal?: AbortSignal): Promise<GmailMessageSummary[]> {
  if (!accessToken) return [];
  const list = await gmailFetch("messages", accessToken, { q: query.slice(0, 500), maxResults: Math.min(Math.max(maxResults, 1), 20) }, signal) as { messages?: Array<{ id?: string; threadId?: string }> };
  const messages = list.messages ?? [];
  const rows = await Promise.all(messages.slice(0, 20).map(async item => {
    if (!item.id) return null;
    const message = await gmailFetch(`messages/${encodeURIComponent(item.id)}`, accessToken, { format: "metadata", metadataHeaders: ["Subject", "From", "To", "Date"] }, signal) as { id?: string; threadId?: string; snippet?: string; labelIds?: string[]; payload?: { headers?: Array<{ name?: string; value?: string }> } };
    const headers = message.payload?.headers;
    return { id: message.id ?? item.id, threadId: message.threadId ?? item.threadId ?? "", subject: headerValue(headers, "Subject"), from: headerValue(headers, "From"), to: headerValue(headers, "To"), date: headerValue(headers, "Date"), snippet: message.snippet ?? "", labelIds: message.labelIds ?? [] } satisfies GmailMessageSummary;
  }));
  return rows.filter((row): row is GmailMessageSummary => Boolean(row));
}

export async function readGmailThread(accessToken: string, threadId: string, signal?: AbortSignal) {
  return gmailFetch(`threads/${encodeURIComponent(threadId)}`, accessToken, { format: "full" }, signal);
}
