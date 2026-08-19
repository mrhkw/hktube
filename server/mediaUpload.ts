import type { Express, Request } from "express";
import express from "express";
import { sdk } from "./_core/sdk";
import { storagePut } from "./storage";

const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 12 * 1024 * 1024;
const MAX_CAPTION_BYTES = 2 * 1024 * 1024;

function safeFilename(value: string) {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return sanitized.slice(0, 120) || "upload";
}

export function allowedContentType(kind: "video" | "thumbnail" | "caption", contentType: string) {
  const type = contentType.toLowerCase().split(";", 1)[0];
  if (kind === "video") return ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-m4v", "video/x-msvideo"].includes(type);
  if (kind === "thumbnail") return ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"].includes(type);
  return type === "text/vtt";
}

export function maxBytesForKind(kind: "video" | "thumbnail" | "caption") {
  if (kind === "video") return MAX_UPLOAD_BYTES;
  if (kind === "thumbnail") return MAX_THUMBNAIL_BYTES;
  return MAX_CAPTION_BYTES;
}

async function requireAdmin(req: Request) {
  const user = await sdk.authenticateRequest(req);
  if (!user || user.role !== "admin") return null;
  return user;
}

export function registerMediaUploadRoute(app: Express) {
  app.post(
    "/api/admin/media-upload",
    express.raw({ type: "application/octet-stream", limit: MAX_UPLOAD_BYTES }),
    async (req, res) => {
      try {
        const user = await requireAdmin(req);
        if (!user) {
          return res.status(403).json({ message: "Only HKTUBE administrators can upload media." });
        }

        const kind = req.query.kind === "thumbnail" ? "thumbnail" : req.query.kind === "video" ? "video" : req.query.kind === "caption" ? "caption" : null;
        const filename = typeof req.query.filename === "string" ? safeFilename(req.query.filename) : "";
        const contentType = typeof req.query.contentType === "string" ? req.query.contentType : "";

        if (!kind || !filename || !allowedContentType(kind, contentType)) {
          return res.status(400).json({ message: "Provide a valid media type, filename, and matching content type." });
        }

        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          return res.status(400).json({ message: "The upload file was empty or unreadable." });
        }
        if (req.body.length > maxBytesForKind(kind)) {
          return res.status(413).json({ message: `This ${kind} exceeds the HKTUBE upload size limit.` });
        }

        const folder = kind === "video" ? "videos" : kind === "thumbnail" ? "thumbnails" : "captions";
        const { key, url } = await storagePut(
          `hktube/${folder}/${user.id}/${Date.now()}-${filename}`,
          req.body,
          contentType,
        );

        return res.status(201).json({ key, url, contentType });
      } catch (error) {
        console.error("[HKTUBE] Media upload failed", error);
        return res.status(500).json({ message: "The media upload could not be completed." });
      }
    },
  );
}
