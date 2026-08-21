import { createServer } from "node:http";
import apiModule from "../api/index.js";
import storageModule from "../api/storage.js";

const api = (apiModule as unknown as { default?: typeof apiModule }).default ?? apiModule;
const storage = (storageModule as unknown as { default?: typeof storageModule }).default ?? storageModule;
const apiServer = createServer(api as never);
const storageServer = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  Object.defineProperty(req, "query", { value: Object.fromEntries(url.searchParams), configurable: true });
  (storage as (request: typeof req, response: typeof res) => void)(req, res);
});

await Promise.all([
  new Promise<void>(resolve => apiServer.listen(0, "127.0.0.1", resolve)),
  new Promise<void>(resolve => storageServer.listen(0, "127.0.0.1", resolve)),
]);

const apiAddress = apiServer.address();
const storageAddress = storageServer.address();
if (!apiAddress || typeof apiAddress === "string" || !storageAddress || typeof storageAddress === "string") {
  throw new Error("Could not determine generated handler ports");
}

try {
  const apiBase = `http://127.0.0.1:${apiAddress.port}`;
  const storageBase = `http://127.0.0.1:${storageAddress.port}`;
  const oauth = await fetch(`${apiBase}/api/oauth/callback`);
  const oauthBody = await oauth.json();
  if (oauth.status !== 400 || oauthBody.error !== "code and state are required") {
    throw new Error(`Generated OAuth handler failed: ${oauth.status} ${JSON.stringify(oauthBody)}`);
  }

  const authMe = await fetch(`${apiBase}/api/trpc/auth.me`);
  const authBody = await authMe.text();
  if (!authMe.ok || authBody.trimStart().startsWith("<html")) {
    throw new Error(`Generated auth.me handler failed: ${authMe.status} ${authBody}`);
  }

  const latest = await fetch(`${apiBase}/api/trpc/videos.latest?input=${encodeURIComponent(JSON.stringify({ json: { limit: 1 } }))}`);
  const latestBody = await latest.text();
  if (!latest.ok || latestBody.trimStart().startsWith("<html")) {
    throw new Error(`Generated videos.latest handler failed: ${latest.status} ${latestBody}`);
  }

  const storage = await fetch(`${storageBase}/api/storage?path=example-key`);
  const storageBody = await storage.text();
  if (storageBody.trimStart().startsWith("<html")) {
    throw new Error("Generated storage handler returned HTML");
  }

  console.log("Generated Vercel handler smoke tests passed", {
    oauthStatus: oauth.status,
    authMeStatus: authMe.status,
    latestStatus: latest.status,
    storageStatus: storage.status,
  });
} finally {
  await Promise.all([
    new Promise<void>((resolve, reject) => apiServer.close(error => error ? reject(error) : resolve())),
    new Promise<void>((resolve, reject) => storageServer.close(error => error ? reject(error) : resolve())),
  ]);
}
