import "dotenv/config";
import type { Request, Response } from "express";
import { createApiApp } from "../server/_core/app";

const app = createApiApp();

export default function handler(req: Request, res: Response) {
  const pathValue = req.query.path;
  const key = Array.isArray(pathValue) ? pathValue.join("/") : pathValue;
  if (typeof key === "string" && key.length > 0) {
    // The storage proxy is registered at /manus-storage/* in the shared app.
    // Vercel invokes this function at /api/storage, so restore that route
    // before handing the request to Express.
    req.url = `/manus-storage/${key}`;
  }
  return app(req, res);
}
