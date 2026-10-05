import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "./_core/env";

const MUX_API = "https://api.mux.com";
const DEEPGRAM_API = "https://api.deepgram.com/v1/listen";
const HIVE_API = "https://api.thehive.ai/api/v2/task/sync";

type ProviderName = "mux" | "deepgram" | "hive" | "upstash" | "sentry";

function configured(name: ProviderName): boolean {
  if (name === "mux") return Boolean(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET);
  if (name === "deepgram") return Boolean(process.env.DEEPGRAM_API_KEY);
  if (name === "hive") return Boolean(process.env.HIVE_API_KEY);
  if (name === "upstash") return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  return Boolean(process.env.SENTRY_DSN);
}

export function providerStatus() {
  return {
    mux: configured("mux"),
    deepgram: configured("deepgram"),
    hive: configured("hive"),
    upstash: configured("upstash"),
    sentry: configured("sentry"),
    database_url: Boolean(process.env.DATABASE_URL),
    supabase_admin: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  } as const;
}

async function jsonRequest(url: string, init: RequestInit, provider: ProviderName) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { message: text.slice(0, 500) }; }
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body ? String((body as { error?: unknown }).error) : `HTTP ${response.status}`;
    throw new Error(`${provider} request failed: ${message.slice(0, 300)}`);
  }
  return body;
}

export async function createMuxAsset(input: { inputUrl: string; passthrough?: string }) {
  if (!configured("mux")) throw new Error("MUX_NOT_CONFIGURED");
  const auth = Buffer.from(`${process.env.MUX_TOKEN_ID}:${process.env.MUX_TOKEN_SECRET}`).toString("base64");
  return jsonRequest(`${MUX_API}/video/v1/assets`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: [{ url: input.inputUrl }], playback_policy: ["public"], passthrough: input.passthrough }),
  }, "mux");
}

export function verifyMuxWebhook(rawBody: string | Buffer, signature: string | undefined, toleranceSeconds = 300) {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const parts = new Map(signature.split(",").map(part => part.split("=", 2) as [string, string]));
  const timestamp = parts.get("t");
  const received = parts.get("v1");
  if (!timestamp || !received || Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody.toString()}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function transcribeWithDeepgram(inputUrl: string, options: { language?: string; model?: string } = {}) {
  if (!configured("deepgram")) throw new Error("DEEPGRAM_NOT_CONFIGURED");
  const params = new URLSearchParams({ model: options.model || "nova-3", smart_format: "true", punctuate: "true", utterances: "true", diarize: "false" });
  if (options.language) params.set("language", options.language);
  return jsonRequest(`${DEEPGRAM_API}?${params}`, {
    method: "POST",
    headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url: inputUrl }),
  }, "deepgram");
}

export async function moderateWithHive(inputUrl: string) {
  if (!configured("hive")) throw new Error("HIVE_NOT_CONFIGURED");
  return jsonRequest(HIVE_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.HIVE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ media_url: inputUrl }),
  }, "hive");
}

export async function upstashFixedWindow(key: string, limit: number, windowSeconds: number) {
  const base = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) return { allowed: true, source: "local" as const, remaining: limit };
  const response = await fetch(`${base}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(windowSeconds), "NX"],
    ]),
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) throw new Error(`upstash request failed: HTTP ${response.status}`);
  const result = await response.json() as Array<{ result?: number }>;
  const count = Number(result?.[0]?.result || 0);
  return { allowed: count <= limit, source: "upstash" as const, remaining: Math.max(0, limit - count) };
}

function parseSentryDsn() {
  const raw = process.env.SENTRY_DSN;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const project = url.pathname.replace(/^\//, "");
    const publicKey = url.username;
    if (!project || !publicKey) return null;
    return { endpoint: `${url.protocol}//${url.host}/api/${project}/store/`, publicKey };
  } catch { return null; }
}

export async function captureSentryException(error: unknown, context: Record<string, string | number | boolean | undefined> = {}) {
  const dsn = parseSentryDsn();
  if (!dsn) return false;
  const exception = error instanceof Error ? error : new Error(String(error));
  const response = await fetch(dsn.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${dsn.publicKey}, sentry_client=hktube/1.0`,
    },
    body: JSON.stringify({
      platform: "node",
      level: "error",
      message: exception.message.slice(0, 500),
      exception: { values: [{ type: exception.name, value: exception.message.slice(0, 500) }] },
      tags: Object.fromEntries(Object.entries(context).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])),
      environment: process.env.NODE_ENV || "production",
    }),
    signal: AbortSignal.timeout(5_000),
  });
  return response.ok;
}
