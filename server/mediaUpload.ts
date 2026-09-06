import type { Express, Request } from "express";
import express from "express";
import { sdk } from "./_core/sdk";
import { archiveStoragePresignPut } from "./archiveStorage";

const MAX_UPLOAD_BYTES = 900 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 12 * 1024 * 1024;
const MAX_CAPTION_BYTES = 2 * 1024 * 1024;

function safeFilename(value: string) { return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 120) || "upload"; }
export function allowedContentType(kind: "video" | "thumbnail" | "caption", contentType: string) {
  const type = contentType.toLowerCase().split(";", 1)[0];
  if (kind === "video") return ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-m4v", "video/x-msvideo"].includes(type);
  if (kind === "thumbnail") return ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"].includes(type);
  return type === "text/vtt";
}
export function maxBytesForKind(kind: "video" | "thumbnail" | "caption") { return kind === "video" ? MAX_UPLOAD_BYTES : kind === "thumbnail" ? MAX_THUMBNAIL_BYTES : MAX_CAPTION_BYTES; }
async function requireAuthenticatedUser(req: Request) { try { return await sdk.authenticateRequest(req); } catch { return null; } }

export function registerMediaUploadRoute(app: Express) {
  app.post("/api/media-upload/presign", express.json(), async (req, res) => {
    try {
      const user = await requireAuthenticatedUser(req);
      if (!user) return res.status(403).json({ message: "Sign in to upload media to HkTube." });
      const kind = req.body?.kind === "thumbnail" ? "thumbnail" : req.body?.kind === "video" ? "video" : req.body?.kind === "caption" ? "caption" : null;
      const filename = typeof req.body?.filename === "string" ? safeFilename(req.body.filename) : "";
      const contentType = typeof req.body?.contentType === "string" ? req.body.contentType : "";
      const size = Number(req.body?.size || 0);
      if (!kind || !filename || !allowedContentType(kind, contentType)) return res.status(400).json({ message: "Provide a valid media type, filename, and matching content type." });
      if (!Number.isFinite(size) || size <= 0 || size > maxBytesForKind(kind)) return res.status(413).json({ message: `This ${kind} exceeds the HkTube upload size limit.` });
      const result = await archiveStoragePresignPut({ userId: user.id, kind, filename, contentType });
      return res.status(201).json({ ...result, contentType, maxBytes: maxBytesForKind(kind), storage: "internet-archive" });
    } catch (error) {
      console.error("[HkTube] Archive.org media presign failed", error);
      return res.status(500).json({ message: error instanceof Error ? error.message : "The Archive.org media upload could not be prepared." });
    }
  });

  /* Kept for small legacy uploads; all writes now go to Internet Archive. */
  app.post("/api/media-upload", express.raw({ type: "application/octet-stream", limit: MAX_UPLOAD_BYTES }), async (req, res) => {
    try {
      const user = await requireAuthenticatedUser(req);
      if (!user) return res.status(403).json({ message: "Sign in to upload media to HkTube." });
      const kind = req.query.kind === "thumbnail" ? "thumbnail" : req.query.kind === "video" ? "video" : req.query.kind === "caption" ? "caption" : null;
      const filename = typeof req.query.filename === "string" ? safeFilename(req.query.filename) : "";
      const contentType = typeof req.query.contentType === "string" ? req.query.contentType : "";
      if (!kind || !filename || !allowedContentType(kind, contentType)) return res.status(400).json({ message: "Provide a valid media type, filename, and matching content type." });
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ message: "The upload file was empty or unreadable." });
      if (req.body.length > maxBytesForKind(kind)) return res.status(413).json({ message: `This ${kind} exceeds the HkTube upload size limit.` });
      const result = await archiveStoragePresignPut({ userId: user.id, kind, filename, contentType });
      const body = Uint8Array.from(req.body);
      const response = await fetch(result.url, { method: "PUT", headers: { "Content-Type": contentType }, body });
      if (!response.ok) throw new Error(`Archive.org upload failed (${response.status}): ${await response.text().catch(() => response.statusText)}`);
      return res.status(201).json({ ...result, contentType, storage: "internet-archive" });
    } catch (error) {
      console.error("[HkTube] Archive.org media upload failed", error);
      return res.status(500).json({ message: error instanceof Error ? error.message : "The Archive.org media upload could not be completed." });
    }
  });
}
