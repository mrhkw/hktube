import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerMediaUploadRoute } from "../mediaUpload";
import { appRouter } from "../routers";
import { createContext } from "./context";

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const GENERAL_LIMIT = 120;
const AUTH_LIMIT = 12;
const UPLOAD_LIMIT = 12;

function clientIp(req: express.Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
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
  if (rateBuckets.size > 5000) {
    for (const [entryKey, entry] of rateBuckets) if (entry.resetAt <= now) rateBuckets.delete(entryKey);
  }
  if (current.count > limit) {
    res.set("Retry-After", String(Math.max(1, Math.ceil((current.resetAt - now) / 1000)));
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

  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "Cross-Origin-Resource-Policy": "same-site",
    });
    if (process.env.NODE_ENV === "production") res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  });

  app.use((req, res, next) => rateLimit(req, res) ? next() : undefined);

  // API JSON payloads are intentionally small; media bytes use the direct storage presign flow.
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "256kb", extended: false }));

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "hktube", timestamp: new Date().toISOString() });
  });

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerMediaUploadRoute(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const parserError = error as { type?: string; status?: number };
    if (parserError.type === "entity.parse.failed" || parserError.status === 400) {
      if (!res.headersSent) res.status(400).json({ error: { message: "Invalid request data. Please try again." } });
      return;
    }
    console.error("[API] Unhandled request error:", error);
    if (res.headersSent) return;
    res.status(500).json({ error: { message: "The server could not complete this request. Please try again." } });
  });

  return app;
}
