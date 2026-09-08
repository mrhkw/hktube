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

  // Body-parser can reject malformed JSON before a request reaches tRPC.
  // Handle that case explicitly so clients always receive JSON instead of a
  // generic platform error and the runtime does not report it as an unhandled
  // application failure.
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const parserError = error as { type?: string; status?: number; message?: string };
    if (parserError.type === "entity.parse.failed" || parserError.status === 400) {
      if (!res.headersSent) {
        res.status(400).json({
          error: {
            message: "Invalid request data. Please try again.",
          },
        });
      }
      return;
    }

    // Vercel can otherwise turn an unhandled Express error into a plain-text
    // response (for example, "A server error occurred"). The tRPC client then
    // tries to parse that response as JSON and reports "Unexpected token 'A'".
    // Always return a JSON error envelope for API failures instead.
    console.error("[API] Unhandled request error:", error);
    if (res.headersSent) return;
    res.status(500).json({
      error: {
        message: "The server could not complete this request. Please try again.",
      },
    });
  });

  return app;
}
