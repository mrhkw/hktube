import type { Express, Request } from "express";
import express from "express";
import { sdk } from "./_core/sdk";
import { archiveStoragePresignPut } from "./archiveStorage";

const MAX_UPLOAD_BYTES = 900 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 12 * 1024 * 1024;
const MAX_CAPTION_BYTES = 2 * 1024 * 1024;

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^[.-]+|[.-]+$/g, "").slice(0, 120) || "upload";
}

function extensionMatches(kind: "video" | "thumbnail" | "caption", filename: string, contentType: string) {
  const extension = filename.toLowerCase().split(".").pop() || "";
  const allowed: Record<typeof kind, Record<string, string[]>> = {
    video: { "video/mp4": ["mp4", "m4v"], "video/webm": ["webm"], "video/ogg": ["ogv", "ogg"], "video/quicktime": ["mov"], "video/x-msvideo": ["avi"] },
    thumbnail: { "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"], "image/avif": ["avif"], "image/gif": ["gif"] },
    caption: { "text/vtt": ["vtt"] },
  };
  return allowed[kind][contentType.toLowerCase().split(";", 1)[0]]?.includes(extension) ?? false;
}

export function allowedContentType(kind: "video" | "thumbnail" | "caption", contentType: string) {
  const type = contentType.toLowerCase().split(";", 1)[0];
  if (kind === "video") return ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-m4v", "video/x-msvideo"].includes(type);
  if (kind === "thumbnail") return ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"].includes(type);
  return type === "text/vtt";
}

export function maxBytesForKind(kind: "video" | "thumbnail" | "caption") {
  return kind === "video" ? MAX_UPLOAD_BYTES : kind === "thumbnail" ? MAX_THUMBNAIL_BYTES : MAX_CAPTION_BYTES;
}

async function requireAuthenticatedUser(req: Request) {
  try {
    return await sdk.authenticateRequest(req);
  } catch {
    return null;
  }
}

export function registerMediaUploadRoute(app: Express) {
  // Media bytes never pass through the HkTube server. This endpoint only issues
  // a short-lived, authenticated storage URL after validating the declared file.
  app.post("/api/media-upload/presign", express.json({ limit: "32kb" }), async (req, res) => {
    try {
      const user = await requireAuthenticatedUser(req);
      if (!user) return res.status(403).json({ message: "Sign in to upload media to HkTube." });
      const kind = req.body?.kind === "thumbnail" ? "thumbnail" : req.body?.kind === "video" ? "video" : req.body?.kind === "caption" ? "caption" : null;
      const filename = typeof req.body?.filename === "string" ? safeFilename(req.body.filename) : "";
      const contentType = typeof req.body?.contentType === "string" ? req.body.contentType : "";
      const size = Number(req.body?.size || 0);
      if (!kind || !filename || !allowedContentType(kind, contentType) || !extensionMatches(kind, filename, contentType)) return res.status(400).json({ message: "Provide a valid filename extension and matching content type." });
      if (!Number.isSafeInteger(size) || size <= 0 || size > maxBytesForKind(kind)) return res.status(413).json({ message: `This ${kind} exceeds the HkTube upload size limit.` });
      const result = await archiveStoragePresignPut({ userId: user.id, kind, filename, contentType, size });
      return res.status(201).json({ ...result, contentType, maxBytes: maxBytesForKind(kind), storage: "internet-archive" });
    } catch (error) {
      console.error("[HkTube] Archive.org media presign failed", error);
      return res.status(500).json({ message: "The media upload could not be prepared. Please try again." });
    }
  });
}
