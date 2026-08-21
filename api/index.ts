import "dotenv/config";
import { createApiApp } from "../server/_core/app";

// Vercel invokes this exported Express-compatible handler for /api/* and
// /manus-storage/* requests. The route registrations remain centralized in
// server/_core/app.ts so local and serverless behavior cannot drift.
export default createApiApp();
