import type { Express, Request, Response } from "express";

export function registerGoogleAuthRoutes(app: Express) {
  app.get("/api/auth/google/client-id", (_req: Request, res: Response) => {
    const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
    if (!clientId) {
      res.status(503).json({ error: { message: "Google sign-in is not configured." } });
      return;
    }
    res.set("Cache-Control", "public, max-age=300, s-maxage=300");
    res.status(200).json({ clientId });
  });
}
