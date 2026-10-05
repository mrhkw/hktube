import express, { type Express } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "./_core/env";
import { createMuxAsset, moderateWithHive, transcribeWithDeepgram, verifyMuxWebhook, captureSentryException, providerStatus, recordProviderOperation } from "./providerIntegrations";

function adminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key ? createClient(ENV.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}
function authClient() {
  return createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
function bearer(req: express.Request) { const value = req.get("authorization") || ""; return value.startsWith("Bearer ") ? value.slice(7) : ""; }
function publicMediaUrl(admin: SupabaseClient, path: string) { return admin.storage.from("videos").getPublicUrl(path).data.publicUrl; }

function transcriptSignals(text: string) {
  const lower = text.toLowerCase();
  const count = (patterns: RegExp[]) => Math.min(1, patterns.reduce((sum, pattern) => sum + (lower.match(pattern)?.length || 0), 0) / 3);
  return {
    transcript_length: text.length,
    transcript_spam_confidence: count([/free money/g, /click the link/g, /limited offer/g, /subscribe now/g]),
    transcript_danger_confidence: count([/how to make a bomb/g, /buy weapons/g, /kill yourself/g]),
    transcript_harassment_confidence: count([/go die/g, /i will find you/g]),
  };
}
function providerSignalSummary(value: unknown): Record<string, number> {
  const output: Record<string, number> = {};
  const visit = (node: unknown, keyPath: string[] = []) => {
    if (Array.isArray(node)) { node.slice(0, 100).forEach(item => visit(item, keyPath)); return; }
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      const normalized = [...keyPath, key].join("_").toLowerCase();
      if (typeof child === "number" && Number.isFinite(child) && child >= 0 && child <= 1) {
        if (/sexual|nudity|porn|violence|graphic|hate|harass|danger|weapon/.test(normalized)) {
          const target = normalized.includes("sexual") || normalized.includes("nudity") || normalized.includes("porn") ? "sexual_confidence" : normalized.includes("violence") ? "violence_confidence" : normalized.includes("graphic") ? "graphic_confidence" : normalized.includes("hate") || normalized.includes("harass") ? "hate_confidence" : "danger_confidence";
          output[target] = Math.max(output[target] || 0, child);
        }
      } else visit(child, [...keyPath, key]);
    }
  };
  visit(value);
  return output;
}

async function analyzeReadyVideo(admin: SupabaseClient, videoId: string) {
  const { data: video } = await admin.from("videos").select("id,video_path").eq("id", videoId).maybeSingle();
  if (!video?.video_path) return;
  const inputUrl = publicMediaUrl(admin, video.video_path);
  const results = await Promise.allSettled([
    transcribeWithDeepgram(inputUrl),
    moderateWithHive(inputUrl),
  ]);
  const signals: Record<string, unknown> = { provider_versions: { deepgram: "configured", hive: "configured" }, analyzed_at: new Date().toISOString() };
  const transcript = results[0].status === "fulfilled" ? results[0].value as any : null;
  const hive = results[1].status === "fulfilled" ? results[1].value : null;
  const transcriptText = String(transcript?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "").slice(0, 50_000);
  if (transcriptText) {
    signals.transcript = transcriptSignals(transcriptText);
    await admin.from("video_transcripts").upsert({ video_id: videoId, transcript: transcriptText, provider: "deepgram", provider_version: "configured", status: "completed", updated_at: new Date().toISOString() }, { onConflict: "video_id" });
  } else if (results[0].status === "rejected") {
    signals.deepgram_error = "provider_request_failed";
  }
  if (hive) signals.visual = providerSignalSummary(hive);
  else if (results[1].status === "rejected") signals.hive_error = "provider_request_failed";
  const hasSignal = Boolean(transcriptText || hive);
  if (hasSignal) await admin.rpc("evaluate_video_safety", { p_video_id: videoId, p_signals: signals, p_engine_version: "hktube-safety/2.0" });
  if (results.some(result => result.status === "rejected")) await captureSentryException(new Error("One or more safety providers failed"), { operation: "post_mux_analysis", video_id: videoId });
}

export function registerProviderRoutes(app: Express) {
  app.get("/api/providers/health", async (_req, res) => {
    const admin = adminClient();
    const health = admin ? await admin.from("provider_health").select("provider_key,state,circuit_state,last_checked_at,last_success_at,last_latency_ms,success_count,failure_count").order("provider_key", { ascending: true }).limit(20) : { data: [] };
    res.status(200).json({ ok: true, providers: providerStatus(), health: health.data ?? [], timestamp: new Date().toISOString() });
  });

  app.post("/api/providers/mux/assets", express.json({ limit: "32kb" }), async (req, res) => {
    const token = bearer(req);
    const admin = adminClient();
    if (!token || !admin) return res.status(503).json({ message: "Provider processing is not configured." });
    const { data: auth } = await authClient().auth.getUser(token);
    const videoId = typeof req.body?.videoId === "string" ? req.body.videoId : "";
    if (!auth.user || !videoId) return res.status(401).json({ message: "Authentication required." });
    const { data: video } = await admin.from("videos").select("id,creator_id,video_path,mux_asset_id").eq("id", videoId).eq("creator_id", auth.user.id).maybeSingle();
    if (!video) return res.status(404).json({ message: "Video not found." });
    if (video.mux_asset_id) return res.status(200).json({ accepted: true, assetId: video.mux_asset_id, duplicate: true });
    try {
      const inputUrl = publicMediaUrl(admin, video.video_path);
      const result = await createMuxAsset({ inputUrl, passthrough: videoId }) as any;
      const assetId = String(result?.data?.id || result?.id || "");
      if (!assetId) throw new Error("Mux returned no asset id");
      await admin.from("videos").update({ mux_asset_id: assetId, media_processing_status: "processing", status: "processing", moderation_status: "pending", visibility: "private", published_at: null }).eq("id", videoId);
      return res.status(202).json({ accepted: true, assetId });
    } catch (error) {
      await admin.from("videos").update({ media_processing_status: "failed", media_processing_error: "mux_asset_creation_failed", moderation_status: "pending", visibility: "private", published_at: null }).eq("id", videoId);
      await captureSentryException(error, { provider: "mux", operation: "create_asset", video_id: videoId });
      return res.status(502).json({ message: "Media processing could not be started." });
    }
  });

  app.post("/api/webhooks/mux", express.raw({ type: "application/json", limit: "2mb" }), async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    if (!verifyMuxWebhook(raw, req.get("mux-signature"))) {
      void recordProviderOperation("mux", "/webhooks/mux", false, 0, new Error("invalid_webhook_signature"));
      return res.status(401).json({ message: "Invalid webhook signature." });
    }
    const admin = adminClient();
    if (!admin) return res.status(503).json({ message: "Webhook persistence is not configured." });
    let event: any;
    try { event = JSON.parse(raw.toString("utf8")); } catch { return res.status(400).json({ message: "Invalid webhook body." }); }
    const eventId = String(event?.id || "");
    const eventType = String(event?.type || "");
    const assetId = String(event?.data?.id || "");
    const providerTimestamp = event?.created_at ? new Date(Number(event.created_at) * 1000) : null;
    if (!eventId || !eventType) return res.status(400).json({ message: "Webhook event is incomplete." });
    const providerEvent = { provider_key: "mux", event_id: eventId, event_type: eventType, provider_timestamp: providerTimestamp?.toISOString() ?? null, payload: { id: eventId, type: eventType, data: { id: assetId } } };
    const { data: latestEvent } = assetId ? await admin.from("provider_webhook_events").select("provider_timestamp").eq("provider_key", "mux").filter("payload->data->>id", "eq", assetId).order("provider_timestamp", { ascending: false }).limit(1).maybeSingle() : { data: null };
    const stale = Boolean(providerTimestamp && latestEvent?.provider_timestamp && providerTimestamp < new Date(latestEvent.provider_timestamp));
    const { error: orderedInsertError } = await admin.from("provider_webhook_events").insert({ ...providerEvent, stale });
    if (orderedInsertError && !/duplicate|unique/i.test(orderedInsertError.message)) return res.status(500).json({ message: "Webhook ordering record failed." });
    if (orderedInsertError) return res.status(200).json({ accepted: true, duplicate: true });
    const { error: insertError } = await admin.from("mux_webhook_events").insert({ event_id: eventId, event_type: eventType, asset_id: assetId || null, received_at: new Date().toISOString(), payload: { id: eventId, type: eventType, data: { id: assetId } } });
    if (insertError && !/duplicate|unique/i.test(insertError.message)) return res.status(500).json({ message: "Webhook persistence failed." });
    if (insertError) return res.status(200).json({ accepted: true, duplicate: true });
    if (stale) {
      void recordProviderOperation("mux", "/webhooks/mux", true, 0);
      return res.status(200).json({ accepted: true, stale: true });
    }
    const videoId = String(event?.data?.passthrough || "");
    const query = videoId ? admin.from("videos").select("id,video_path").eq("id", videoId).maybeSingle() : admin.from("videos").select("id,video_path").eq("mux_asset_id", assetId).maybeSingle();
    const { data: video } = await query;
    if (video) {
      if (eventType === "video.asset.ready") {
        const playbackId = String(event?.data?.playback_ids?.[0]?.id || "");
        await admin.from("videos").update({ mux_playback_id: playbackId || null, media_processing_status: "ready", media_processing_error: null, media_processed_at: new Date().toISOString(), status: "ready", moderation_status: "pending", visibility: "private", published_at: null }).eq("id", video.id);
        void analyzeReadyVideo(admin, video.id);
      } else if (eventType === "video.asset.errored") {
        await admin.from("videos").update({ media_processing_status: "failed", media_processing_error: "mux_asset_processing_failed", moderation_status: "pending", visibility: "private", published_at: null }).eq("id", video.id);
      }
    }
    void recordProviderOperation("mux", "/webhooks/mux", true, 0);
    return res.status(200).json({ accepted: true });
  });
}
