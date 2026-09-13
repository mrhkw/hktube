import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

const isDevelopment = process.env.NODE_ENV !== "production";
const plugins = [react(), tailwindcss(), ...(isDevelopment ? [jsxLocPlugin(), vitePluginManusRuntime()] : [])];

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
    cssCodeSplit: true,
    sourcemap: false,
    reportCompressedSize: true,
    rollupOptions: { output: { manualChunks } },
  },
  server: {
    host: true,
    allowedHosts: [".manuspre.computer", ".manus.computer", ".manus-asia.computer", ".manuscomputer.ai", ".manusvm.computer", "localhost", "127.0.0.1"],
    fs: { strict: true, deny: ["**/.*"] },
  },
});
