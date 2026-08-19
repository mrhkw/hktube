import type { Express, Request } from "express";
import express from "express";
import { sdk } from "./_core/sdk";
import { storagePut } from "./storage";

const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

function safeFilename(value: string) {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return sanitized.slice(0, 120) || "upload";
}

function allowedContentType(kind: "video" | "thumbnail" | "caption", contentType: string) {
  if (kind === "video") return contentType.startsWith("video/");
  if (kind === "thumbnail") return contentType.startsWith("image/");
  return contentType === "text/vtt";
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
