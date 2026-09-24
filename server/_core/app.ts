import express, { type Express } from "express";
import { randomUUID } from "node:crypto";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerMediaUploadRoute } from "../mediaUpload";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { CONTENT_SECURITY_POLICY, SECURITY_HEADERS } from "@shared/security";

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const GENERAL_LIMIT = 120;
const AUTH_LIMIT = 12;
const UPLOAD_LIMIT = 12;
const MAX_RATE_BUCKETS = 5000;
const MAX_URL_LENGTH = 4096;
const MAX_HEADER_BYTES = 32_768;
const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

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

function securityGate(req: express.Request, res: express.Response) {
  const rawPath = req.originalUrl || req.url;
  if (!ALLOWED_METHODS.has(req.method) || rawPath.length > MAX_URL_LENGTH) {
    res.status(400).json({ error: { message: "Invalid request." } });
    return false;
  }
  const headerBytes = Object.entries(req.headers).reduce((total, [key, value]) => total + key.length + String(value ?? "").length, 0);
  if (headerBytes > MAX_HEADER_BYTES) {
    res.status(431).json({ error: { message: "Request headers are too large." } });
    return false;
  }
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

function rateLimit(req: express.Request, res: express.Response) {
  const path = req.path;
  const bucket = path.startsWith("/api/media-upload") ? "upload" : path.startsWith("/api/trpc/auth.") ? "auth" : "general";
  const limit = bucket === "auth" ? AUTH_LIMIT : bucket === "upload" ? UPLOAD_LIMIT : GENERAL_LIMIT;
  const key = `${bucket}:${clientIp(req)}`;
  const now = Date.now();
  const existing = rateBuckets.get(key);
  const current = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + RATE_WINDOW_MS } : existing;
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
    if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
    if (process.env.NODE_ENV === "production") res.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
    if (securityGate(req, res)) next();
  });
  app.use((req, res, next) => rateLimit(req, res) ? next() : undefined);
  app.use(express.json({ limit: "2mb", strict: true }));
  app.use(express.urlencoded({ limit: "256kb", extended: false, parameterLimit: 100 }));
  app.get("/api/health", (_req, res) => res.status(200).json({ ok: true, service: "hktube", timestamp: new Date().toISOString() }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerMediaUploadRoute(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const parserError = error as { type?: string; status?: number };
    if (parserError.type === "entity.parse.failed" || parserError.status === 400) { if (!res.headersSent) res.status(400).json({ error: { message: "Invalid request data. Please try again." } }); return; }
    console.error("[API] Unhandled request error:", error);
    if (!res.headersSent) res.status(500).json({ error: { message: "The server could not complete this request. Please try again." } });
  });
  return app;
}
