import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerMediaUploadRoute } from "../mediaUpload";
import { appRouter } from "../routers";
import { createContext } from "./context";

/**
 * Build the HTTP API surface shared by the local server and Vercel.
 * Static serving is intentionally kept outside this factory because Vercel
 * serves the Vite output itself and invokes the API as a serverless function.
 */
export function createApiApp(): Express {
  const app = express();

  // Keep the generous JSON/urlencoded limits used by the existing server.
  // The media upload route uses its own raw body parser for octet-stream data.
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerMediaUploadRoute(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  return app;
}
