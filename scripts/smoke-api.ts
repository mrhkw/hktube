import { createServer } from "node:http";
import { createApiApp } from "../server/_core/app";

const server = createServer(createApiApp());
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Could not determine test port");
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const oauth = await fetch(`${baseUrl}/api/oauth/callback`);
  const oauthBody = await oauth.json();
  if (oauth.status !== 400 || oauthBody.error !== "code and state are required") {
    throw new Error(`OAuth callback smoke test failed: ${oauth.status} ${JSON.stringify(oauthBody)}`);
  }

  const authMe = await fetch(`${baseUrl}/api/trpc/auth.me`);
  const authBody = await authMe.text();
  if (authMe.headers.get("content-type")?.includes("text/html")) {
    throw new Error("auth.me returned HTML instead of an API response");
  }
  if (!authMe.ok) {
    throw new Error(`auth.me smoke test failed: ${authMe.status} ${authBody}`);
  }

  const storage = await fetch(`${baseUrl}/manus-storage/example-key`);
  const storageBody = await storage.text();
  if (storageBody.trimStart().startsWith("<!doctype html") || storageBody.trimStart().startsWith("<html")) {
    throw new Error("storage proxy returned the SPA HTML fallback instead of an API response");
  }
  if (storage.status !== 500 && storage.status !== 502) {
    throw new Error(`storage proxy smoke test failed: ${storage.status} ${storageBody}`);
  }

  console.log("API smoke tests passed", {
    oauthStatus: oauth.status,
    authMeStatus: authMe.status,
    storageStatus: storage.status,
  });
} finally {
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
}
