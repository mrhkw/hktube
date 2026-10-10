import type { Express, Request, Response } from "express";
import { extractBearerToken, isAllowedAdminIdentity } from "./adminAgent";
import { ENV } from "./env";

type AuthUser = { id?: unknown; email?: unknown };
type ChannelTarget = { id: string; owner_id: string; name: string; handle: string; verification_status: string };

function config() {
  if (!ENV.supabaseUrl || !ENV.supabaseAnonKey || !ENV.supabaseServiceRoleKey) return null;
  return { url: ENV.supabaseUrl.replace(/\/$/, ""), anonKey: ENV.supabaseAnonKey, serviceKey: ENV.supabaseServiceRoleKey };
}

async function verifyOwner(req: Request): Promise<AuthUser | null> {
  const token = extractBearerToken(req.headers.authorization);
  const current = config();
  if (!token || !current) return null;
  const response = await fetch(`${current.url}/auth/v1/user`, {
    headers: { apikey: current.anonKey, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;
  const user = await response.json() as AuthUser;
  return isAllowedAdminIdentity(user) ? user : null;
}

async function adminRest(path: string, current: ReturnType<typeof config>, init?: RequestInit) {
  if (!current) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return fetch(`${current.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: current.serviceKey,
      Authorization: `Bearer ${current.serviceKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: init?.signal ?? AbortSignal.timeout(10_000),
  });
}

async function listUsers(current: ReturnType<typeof config>) {
  if (!current) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  const response = await fetch(`${current.url}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: { apikey: current.serviceKey, Authorization: `Bearer ${current.serviceKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Supabase admin users could not be loaded.");
  const payload = await response.json() as { users?: AuthUser[] };
  return payload.users ?? [];
}

async function listChannels(current: ReturnType<typeof config>, ownerId?: string) {
  const filter = ownerId ? `&owner_id=eq.${encodeURIComponent(ownerId)}` : "";
  const response = await adminRest(`channels?select=id,owner_id,name,handle,verification_status&order=created_at.desc&limit=1000${filter}`, current);
  if (!response.ok) throw new Error("Channel owners could not be loaded.");
  return await response.json() as ChannelTarget[];
}

export function registerAdminVerificationRoute(app: Express) {
  app.get("/api/admin/verification/targets", async (req: Request, res: Response) => {
    try {
      const owner = await verifyOwner(req);
      const current = config();
      if (!owner || !current) { res.status(owner ? 503 : 403).json({ error: { message: owner ? "Admin verification is not configured yet." : "Only an authorized HkTube admin can manage verification." } }); return; }
      const [users, channels] = await Promise.all([listUsers(current), listChannels(current)]);
      const usersById = new Map(users.map(user => [String(user.id ?? ""), user]));
      const targets = channels.map(channel => {
        const user = usersById.get(String(channel.owner_id));
        return { email: typeof user?.email === "string" ? user.email.trim().toLowerCase() : "", channels: [{ id: String(channel.id), name: channel.name, handle: channel.handle, verificationStatus: channel.verification_status }] };
      }).filter(target => target.email);
      const merged = new Map<string, { email: string; channels: Array<{ id: string; name: string; handle: string; verificationStatus: string }> }>();
      for (const target of targets) { const existing = merged.get(target.email); if (existing) existing.channels.push(...target.channels); else merged.set(target.email, target); }
      res.json({ targets: [...merged.values()] });
    } catch (error) {
      res.status(503).json({ error: { message: error instanceof Error ? error.message : "Verification targets could not be loaded." } });
    }
  });

  app.post("/api/admin/verification/grant", async (req: Request, res: Response) => {
    await updateVerification(req, res, "verified");
  });

  app.post("/api/admin/verification/revoke", async (req: Request, res: Response) => {
    await updateVerification(req, res, "unverified");
  });
}

async function updateVerification(req: Request, res: Response, status: "verified" | "unverified") {
  try {
    const owner = await verifyOwner(req);
    const current = config();
    if (!owner || !current) { res.status(owner ? 503 : 403).json({ error: { message: owner ? "Admin verification is not configured yet." : "Only an authorized HkTube admin can manage verification." } }); return; }
    const targetEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const channelId = typeof req.body?.channelId === "string" ? req.body.channelId.trim() : "";
    if (!targetEmail || !targetEmail.includes("@") || !channelId) { res.status(400).json({ error: { message: "Target Gmail aur channel select karna zaroori hai." } }); return; }
    const users = await listUsers(current);
    const targetUser = users.find(user => typeof user.email === "string" && user.email.trim().toLowerCase() === targetEmail);
    if (!targetUser?.id) { res.status(404).json({ error: { message: "Is Gmail ka HkTube channel nahi mila." } }); return; }
    const response = await adminRest(`channels?id=eq.${encodeURIComponent(channelId)}&owner_id=eq.${encodeURIComponent(String(targetUser.id))}`, current, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ verification_status: status, updated_at: new Date().toISOString() }),
    });
    if (!response.ok) { res.status(502).json({ error: { message: "Verification badge update nahi ho saka." } }); return; }
    const updated = await response.json() as ChannelTarget[];
    if (!updated.length) { res.status(404).json({ error: { message: "Selected channel is Gmail owner se match nahi karta." } }); return; }
    res.json({ ok: true, status, email: targetEmail, channel: updated[0] });
  } catch (error) {
    res.status(503).json({ error: { message: error instanceof Error ? error.message : "Verification action failed." } });
  }
}
