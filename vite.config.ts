import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

// =============================================================================
// Manus Debug Collector - Vite Plugin
// Writes browser logs directly to files, trimmed when exceeding size limit
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}
function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) return;
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > TRIM_TARGET_BYTES) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch { /* ignore trim errors */ }
}
function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => `[${new Date().toISOString()}] ${JSON.stringify(entry)}`);
  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") return html;
      return { html, tags: [{ tag: "script", attrs: { src: "/__manus__/debug-collector.js", defer: true }, injectTo: "head" }] };
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") return next();
        const handlePayload = (payload: any) => {
          if (payload.consoleLogs?.length > 0) writeToLogFile("browserConsole", payload.consoleLogs);
          if (payload.networkRequests?.length > 0) writeToLogFile("networkRequests", payload.networkRequests);
          if (payload.sessionEvents?.length > 0) writeToLogFile("sessionReplay", payload.sessionEvents);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = (req as { body?: unknown }).body;
        if (reqBody && typeof reqBody === "object") {
          try { handlePayload(reqBody); } catch (e) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ success: false, error: String(e) })); }
          return;
        }
        let body = "";
        req.on("data", (chunk) => { body += chunk.toString(); });
        req.on("end", () => {
          try { handlePayload(JSON.parse(body)); } catch (e) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ success: false, error: String(e) })); }
        });
      });
    },
  };
}

const isDevelopment = process.env.NODE_ENV !== "production";
const plugins = [react(), tailwindcss(), ...(isDevelopment ? [jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()] : [])];

function manualChunks(id: string) {
  if (!id.includes("node_modules")) return undefined;
  if (id.includes("/@radix-ui/")) return "radix-ui";
  if (id.includes("/@supabase/")) return "supabase";
  if (id.includes("/@trpc/")) return "trpc";
  if (id.includes("/lucide-react/")) return "icons";
  if (id.includes("/date-fns/")) return "date-utils";
  if (id.includes("/superjson/")) return "serialization";
  if (id.includes("/zod/")) return "validation";
  return undefined;
}

export default defineConfig({
  plugins,
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "client", "src"), "@shared": path.resolve(import.meta.dirname, "shared"), "@assets": path.resolve(import.meta.dirname, "attached_assets") } },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: { output: { manualChunks } },
  },
  server: {
    host: true,
    allowedHosts: [".manuspre.computer", ".manus.computer", ".manus-asia.computer", ".manuscomputer.ai", ".manusvm.computer", "localhost", "127.0.0.1"],
    fs: { strict: true, deny: ["**/.*"] },
  },
});
