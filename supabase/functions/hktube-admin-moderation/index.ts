import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Moderation gateway is not configured" }, 503);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Invalid session" }, 401);

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError || !profile || !["admin", "moderator"].includes(profile.role)) {
    return json({ error: "Admin access required" }, 403);
  }

  let input: { action?: string; videoId?: string; moderationStatus?: string; reportId?: string; reportStatus?: string };
  try { input = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  if (input.action === "moderate") {
    if (!input.videoId || !/^[0-9a-f-]{36}$/i.test(input.videoId)) return json({ error: "Invalid video id" }, 400);
    if (!input.moderationStatus || !["approved", "rejected", "flagged"].includes(input.moderationStatus)) return json({ error: "Invalid moderation status" }, 400);
    const { data, error } = await adminClient.rpc("moderate_video", {
      p_video_id: input.videoId,
      p_moderation_status: input.moderationStatus,
    });
    if (error) return json({ error: "Moderation action failed" }, 400);
    return json({ ok: true, data });
  }

  if (input.action === "resolve_report") {
    if (!input.reportId || !/^[0-9a-f-]{36}$/i.test(input.reportId)) return json({ error: "Invalid report id" }, 400);
    if (!input.reportStatus || !["resolved", "dismissed"].includes(input.reportStatus)) return json({ error: "Invalid report status" }, 400);
    const { data, error } = await adminClient.rpc("resolve_video_report", {
      p_report_id: input.reportId,
      p_status: input.reportStatus,
    });
    if (error) return json({ error: "Report action failed" }, 400);
    return json({ ok: true, data });
  }

  return json({ error: "Unsupported moderation action" }, 400);
});
