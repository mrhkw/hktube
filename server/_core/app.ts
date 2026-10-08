import express, { type Express } from "express";
import { createHash, randomUUID } from "node:crypto";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerGoogleAuthRoutes } from "./googleAuth";
import { registerStorageProxy } from "./storageProxy";
import { registerMediaUploadRoute } from "../mediaUpload";
import { registerAdminAgentRoute } from "./adminAgent";
import { registerAIAdminRoute } from "./aiAdminRoute";
import { registerProviderRoutes } from "../providerRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { CONTENT_SECURITY_POLICY, SECURITY_HEADERS } from "@shared/security";
import { captureSentryException, providerStatus, upstashFixedWindow } from "../providerIntegrations";

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const GENERAL_LIMIT = 120;
const AUTH_LIMIT = 12;
const AUTH_ATTEMPT_LIMIT = 6;
const AUTH_ATTEMPT_WINDOW_MS = 15 * 60_000;
const UPLOAD_LIMIT = 12;
const ADMIN_AGENT_LIMIT = 12;
const AI_LIMIT = 12;
const WEBHOOK_LIMIT = 60;
const SOCIAL_LIMIT = 45;
const SEARCH_LIMIT = 90;
const REPORT_LIMIT = 10;
const MAX_RATE_BUCKETS = 5000;

function clientIp(req: express.Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function hasSessionCookie(req: express.Request) {
  return /(?:^|;)\s*app_session_id=/.test(req.headers.cookie || "");
}

function requestOrigin(req: express.Request) {
  const origin = req.get("origin")?.trim();
  if (origin) return origin;
  const referer = req.get("referer")?.trim();
  if (!referer) return "";
  try { return new URL(referer).origin; } catch { return ""; }
}

function targetOrigin(req: express.Request) {
  const proto = String(req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
  const host = String(req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
  return host ? `${proto}://${host}` : "";
}

function isTrustedOrigin(req: express.Request, origin: string) {
  try {
    const parsed = new URL(origin);
    const target = targetOrigin(req);
    if (target) return parsed.origin === target;
    const requestHost = req.get("host")?.split(":")[0];
    if (parsed.protocol === "https:") return parsed.hostname === requestHost;
    return parsed.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch { return false; }
}

function isAllowedCorsOrigin(req: express.Request, origin: string) {
  try {
    const parsed = new URL(origin);
    const target = targetOrigin(req);
    if (target && parsed.origin === target) return true;
    const configured = (process.env.ALLOWED_ORIGINS || "https://hktube.vercel.app")
      .split(",")
      .map(value => value.trim().replace(/\/$/, ""))
      .filter(Boolean);
    return configured.includes(parsed.origin);
  } catch {
    return false;
  }
}

function securityGate(req: express.Request, res: express.Response) {
  const rawPath = req.originalUrl || req.url;
  if (/\0|\.\.(?:\/|\\)|%2e%2e|%00/i.test(rawPath)) {
    console.warn(`[Security] blocked path traversal ip=${clientIp(req)}`);
    res.status(400).json({ error: { message: "Invalid request path." } });
    return false;
  }

  const mutating = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  if (mutating && hasSessionCookie(req)) {
    const origin = requestOrigin(req);
    // Cookie-authenticated mutations fail closed when the browser does not
    // identify a same-origin source. This closes the CSRF gap created by the
    // OAuth-compatible SameSite=None session cookie.
    if (!origin || !isTrustedOrigin(req, origin)) {
      console.warn(`[Security] blocked unauthenticated-origin mutation ip=${clientIp(req)}`);
      res.status(403).json({ error: { message: "Cross-origin request blocked." } });
      return false;
    }
  } else if (mutating) {
    const origin = req.get("origin");
    if (origin && !isTrustedOrigin(req, origin)) {
      console.warn(`[Security] blocked cross-origin mutation ip=${clientIp(req)}`);
      res.status(403).json({ error: { message: "Cross-origin request blocked." } });
      return false;
    }
  }

  return true;
}

async function rateLimit(req: express.Request, res: express.Response) {
  const path = req.path;
  const bucket = path.startsWith("/api/admin-agent/") || path.startsWith("/api/admin/") ? "admin-agent" : path.startsWith("/api/ai/") ? "ai" : path.startsWith("/api/media-upload") ? "upload" : path.startsWith("/api/providers/") ? "provider-job" : path.startsWith("/api/webhooks/") ? "webhook" : /\/api\/trpc\/auth\.(login|register)(?:$|[?])/.test(path) ? "auth-attempt" : path.startsWith("/api/trpc/auth.") ? "auth" : /comment|like|follow|share/i.test(path) ? "social" : /report/i.test(path) ? "report" : /search/i.test(path) ? "search" : "general";
  const limit = bucket === "admin-agent" ? ADMIN_AGENT_LIMIT : bucket === "ai" ? AI_LIMIT : bucket === "auth-attempt" ? AUTH_ATTEMPT_LIMIT : bucket === "auth" ? AUTH_LIMIT : bucket === "upload" ? UPLOAD_LIMIT : bucket === "webhook" ? WEBHOOK_LIMIT : bucket === "social" ? SOCIAL_LIMIT : bucket === "report" ? REPORT_LIMIT : bucket === "search" ? SEARCH_LIMIT : GENERAL_LIMIT;
  const windowMs = bucket === "auth-attempt" ? AUTH_ATTEMPT_WINDOW_MS : RATE_WINDOW_MS;
  const bearer = req.get("authorization") || "";
  const identity = bearer.startsWith("Bearer ") ? createHash("sha256").update(bearer.slice(7)).digest("hex").slice(0, 16) : "anonymous";
  const key = `${bucket}:${clientIp(req)}:${identity}`;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const remote = await upstashFixedWindow(key, limit, Math.ceil(windowMs / 1000));
      if (!remote.allowed) {
        res.set("Retry-After", String(Math.ceil(windowMs / 1000)));
        res.status(429).json({ error: { message: "Too many requests. Please slow down and try again shortly." } });
        return false;
      }
      return true;
    } catch (error) {
      void captureSentryException(error, { provider: "upstash", operation: "rate_limit", bucket });
    }
  }
  const now = Date.now();
  const existing = rateBuckets.get(key);
  const current = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + windowMs } : existing;
  current.count += 1;
  rateBuckets.set(key, current);
  if (rateBuckets.size > MAX_RATE_BUCKETS) rateBuckets.forEach((entry, entryKey) => { if (entry.resetAt <= now) rateBuckets.delete(entryKey); });
  if (current.count > limit) {
    res.set("Retry-After", String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))));
    res.status(429).json({ error: { message: "Too many requests. Please slow down and try again shortly." } });
    return false;
  }
  return true;
}

/** Build the HTTP API surface shared by the local server and Vercel. */
export function createApiApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use((req, res, next) => {
    res.set({
      "X-Request-Id": randomUUID(),
      ...SECURITY_HEADERS,
      "Content-Security-Policy": CONTENT_SECURITY_POLICY,
    });
    const origin = req.get("origin")?.trim();
    if (origin) {
      if (!isAllowedCorsOrigin(req, origin)) {
        if (req.method === "OPTIONS") {
          res.status(403).json({ error: { message: "Cross-origin request blocked." } });
          return;
        }
      } else {
        res.set({
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-TRPC-Source, X-Google-Provider-Token",
          Vary: "Origin",
        });
        if (req.method === "OPTIONS") {
          res.status(204).end();
          return;
        }
      }
    }
    if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
    if (process.env.NODE_ENV === "production") res.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    if (securityGate(req, res)) next();
  });
  app.use((req, res, next) => { void rateLimit(req, res).then(allowed => { if (allowed) next(); }); });
  registerProviderRoutes(app);
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "256kb", extended: false }));
  app.get("/api/health", (_req, res) => res.status(200).json({ ok: true, service: "hktube", providers: providerStatus(), timestamp: new Date().toISOString() }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerGoogleAuthRoutes(app);
  registerMediaUploadRoute(app);
  registerAdminAgentRoute(app);
  registerAIAdminRoute(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const parserError = error as { type?: string; status?: number };
    if (parserError.type === "entity.parse.failed" || parserError.status === 400) { if (!res.headersSent) res.status(400).json({ error: { message: "Invalid request data. Please try again." } }); return; }
    console.error("[API] Unhandled request error:", error);
    void captureSentryException(error, { operation: "unhandled_api_error", path: _req.path });
    if (!res.headersSent) res.status(500).json({ error: { message: "The server could not complete this request. Please try again." } });
  });
  return app;
}
