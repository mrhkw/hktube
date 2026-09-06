import type { Request, Response } from "express";
import { createApiApp } from "./app";

let app: ReturnType<typeof createApiApp> | undefined;

/** Vercel entrypoint source; bundled into api/index.js during the project build. */
export default function handler(req: Request, res: Response) {
  try {
    app ??= createApiApp();
    return app(req, res);
  } catch (error) {
    console.error("[Vercel] API initialization failed:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: { message: "The API could not start. Please try again." } });
    }
  }
}
