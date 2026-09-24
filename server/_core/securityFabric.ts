import { createHash, randomBytes } from "node:crypto";
import type { Request } from "express";

const MAX_TRACKED_FINGERPRINTS = 10_000;
const fingerprints = new Map<string, { score: number; seen: number; lastSeen: number }>();

function compact(value: string, max: number): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max);
}

export function requestFingerprint(req: Request): string {
  const material = [
    compact(req.ip || req.socket.remoteAddress || "unknown", 128),
    compact(String(req.get("user-agent") || ""), 256),
    compact(String(req.get("accept-language") || ""), 128),
    compact(String(req.get("sec-ch-ua") || ""), 256),
  ].join("|");
  return createHash("sha256").update(material).digest("hex");
}

export function securityRiskScore(req: Request): number {
  let score = 0;
  const path = req.path.toLowerCase();
  const ua = String(req.get("user-agent") || "").toLowerCase();
  const query = String(req.originalUrl || "").split("?")[1] || "";

  if (!ua) score += 10;
  if (ua.length > 512) score += 15;
  if (query.length > 4096) score += 20;
  if (/(?:\.\.%2f|\.\.%5c|%00|<script|javascript:|union(?:\s|%20)+select|sleep\s*\(|benchmark\s*\()/i.test(String(req.originalUrl || ""))) score += 60;
  if (/(?:wp-admin|wp-login|\.env|phpmyadmin|cgi-bin|actuator|server-status)/i.test(path)) score += 35;
  if (/(?:sqlmap|nikto|nmap|masscan|zgrab|nessus)/i.test(ua)) score += 40;
  if (req.method === "TRACE" || req.method === "CONNECT") score += 100;

  return Math.min(100, score);
}

export function observeSecurityRequest(req: Request): { requestId: string; score: number; suspicious: boolean } {
  const id = requestFingerprint(req);
  const score = securityRiskScore(req);
  const now = Date.now();
  const current = fingerprints.get(id) || { score: 0, seen: 0, lastSeen: now };
  current.score = Math.max(score, current.score * 0.85);
  current.seen += 1;
  current.lastSeen = now;
  fingerprints.set(id, current);

  if (fingerprints.size > MAX_TRACKED_FINGERPRINTS) {
    const cutoff = now - 15 * 60_000;
    for (const [key, value] of fingerprints) {
      if (value.lastSeen < cutoff) fingerprints.delete(key);
    }
    if (fingerprints.size > MAX_TRACKED_FINGERPRINTS) {
      const first = fingerprints.keys().next().value;
      if (first) fingerprints.delete(first);
    }
  }

  return { requestId: id.slice(0, 24), score: Math.round(current.score), suspicious: current.score >= 60 };
}

export function securityNonce(): string {
  return randomBytes(18).toString("base64url");
}
