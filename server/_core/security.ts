import type { Express, NextFunction, Request, Response } from "express";

const WINDOW_MS = 60_000;
const GENERAL_LIMIT = 300;
const AUTH_LIMIT = 15;
const UPLOAD_LIMIT = 30;
const buckets = new Map<string, { resetAt: number; count: number }>();

function clientIp(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function hit(key: string, limit: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const next = { resetAt: now + WINDOW_MS, count: 1 };
    buckets.set(key, next);
    return { allowed: true, retryAfter: 60 };
  }
  current.count += 1;
  return {
    allowed: current.count <= limit,
    retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

function isStateChanging(req: Request) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(req.method.toUpperCase());
}

function hasSessionCookie(req: Request) {
  const cookie = req.headers.cookie || "";
  return /(?:^|;)\s*(?:hktube_session|hktube_session_token|session)=/.test(cookie) || /(?:^|;)\s*[^=]*session[^=]*=/.test(cookie);
}

function targetOrigin(req: Request) {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  return host ? `${proto}://${host}` : "";
}

function originFromReferer(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function csrfAllowed(req: Request) {
  if (!isStateChanging(req) || !hasSessionCookie(req)) return true;

  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  if (fetchSite === "cross-site") return false;
  if (fetchSite === "same-origin") return true;

  const target = targetOrigin(req);
  const origin = String(req.headers.origin || "").trim();
  if (origin && target) return origin === target;

  const referer = String(req.headers.referer || "").trim();
  if (referer && target) return originFromReferer(referer) === target;

  // Authenticated state-changing requests without browser origin metadata are
  // rejected. This is intentionally fail-closed for cookie-authenticated APIs.
  return false;
}

export function registerSecurityMiddleware(app: Express) {
  app.disable("x-powered-by");
  app.set("trust proxy", true);

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    if (req.secure || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Vary", "Origin, Sec-Fetch-Site");

    if (!csrfAllowed(req)) {
      return res.status(403).json({ error: { message: "Cross-site state-changing request blocked." } });
    }

    if (req.path === "/health") return next();

    const ip = clientIp(req);
    let limit = GENERAL_LIMIT;
    let bucket = "api";
    if (req.path.includes("/auth.login") || req.path.includes("/auth.register")) {
      limit = AUTH_LIMIT;
      bucket = "auth";
    } else if (req.path === "/media-upload" || req.path === "/media-upload/presign") {
      limit = UPLOAD_LIMIT;
      bucket = "upload";
    }

    const result = hit(`${bucket}:${ip}`, limit);
    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfter));
      return res.status(429).json({ error: { message: "Too many requests. Please try again shortly." } });
    }
    next();
  });
}

export function __resetSecurityBucketsForTests() {
  buckets.clear();
}

export function __securityInternalsForTests() {
  return { csrfAllowed, hit };
}
