import type { Express, Request, Response } from "express";
import { ENV } from "./env";

type SupabaseUser = { id?: unknown };

function bearerToken(req: Request): string | null {
  const value = req.headers.authorization;
  if (typeof value !== "string" || !value.startsWith("Bearer ")) return null;
  const token = value.slice(7).trim();
  return token && token.length <= 8192 ? token : null;
}

export function registerAccountDeletionRoute(app: Express) {
  app.post("/api/account/deletion-request", async (req: Request, res: Response) => {
    const token = bearerToken(req);
    if (!token) { res.status(401).json({ error: { message: "Sign in to request account deletion." } }); return; }

    const url = ENV.supabaseUrl.replace(/\/$/, "");
    const anonKey = ENV.supabaseAnonKey;
    const serviceKey = ENV.supabaseServiceRoleKey;
    if (!url || !anonKey || !serviceKey) {
      res.status(503).json({ error: { message: "Account deletion requests are not configured on the server yet. No request was submitted." } });
      return;
    }

    try {
      const identityResponse = await fetch(`${url}/auth/v1/user`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!identityResponse.ok) { res.status(401).json({ error: { message: "Your session expired. Sign in again before requesting deletion." } }); return; }

      const user = await identityResponse.json() as SupabaseUser;
      const userId = typeof user.id === "string" ? user.id : "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
        res.status(401).json({ error: { message: "The signed-in account could not be verified." } }); return;
      }

      const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
      const existingUrl = new URL(`${url}/rest/v1/privacy_erasure_requests`);
      existingUrl.searchParams.set("select", "id,status,requested_at");
      existingUrl.searchParams.set("subject_id", `eq.${userId}`);
      existingUrl.searchParams.set("request_type", "eq.account");
      existingUrl.searchParams.set("status", "in.(requested,processing)");
      existingUrl.searchParams.set("limit", "1");

      const existingResponse = await fetch(existingUrl, { headers, signal: AbortSignal.timeout(8000) });
      if (!existingResponse.ok) { res.status(503).json({ error: { message: "The deletion request queue is unavailable. No request was submitted." } }); return; }
      const existing = await existingResponse.json() as Array<{ id: string; status: string }>;
      if (existing.length) {
        res.status(202).json({ ok: true, alreadyPending: true, status: existing[0].status, message: "A deletion request is already pending for this account." });
        return;
      }

      const insertResponse = await fetch(`${url}/rest/v1/privacy_erasure_requests`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ subject_id: userId, request_type: "account", status: "requested", metadata: { source: "self_service", requested_by_verified_session: true } }),
        signal: AbortSignal.timeout(8000),
      });
      if (!insertResponse.ok) { res.status(503).json({ error: { message: "The deletion request could not be saved. No request was submitted." } }); return; }
      res.status(202).json({ ok: true, alreadyPending: false, status: "requested", message: "Your request was recorded for operator processing. Your account has NOT been deleted yet." });
    } catch {
      res.status(503).json({ error: { message: "The deletion request service is temporarily unavailable. No request was confirmed." } });
    }
  });
}
