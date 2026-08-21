import type { Request, Response } from "express";
import { createApiApp } from "./app";

const app = createApiApp();

/** Vercel entrypoint source; bundled into api/storage.js during the project build. */
export default function handler(req: Request, res: Response) {
  const pathValue = req.query.path;
  const key = Array.isArray(pathValue) ? pathValue.join("/") : pathValue;
  if (typeof key === "string" && key.length > 0) {
    req.url = `/manus-storage/${key}`;
  }
  return app(req, res);
}
