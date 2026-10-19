import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { COOKIE_NAME } from "../../shared/const";
import { createApiApp } from "./app";

const envKeys = ["ALLOWED_ORIGINS", "VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL", "NODE_ENV"] as const;
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.ALLOWED_ORIGINS = "https://trusted.example";
  delete process.env.VERCEL_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  server = createServer(createApiApp());
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  for (const key of envKeys) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Express origin/CSRF security gate", () => {
  it("blocks a forged Origin even when X-Forwarded-Host/Proto claim it is same-origin", async () => {
    const response = await fetch(`${baseUrl}/api/media-upload/presign`, {
      method: "POST",
      headers: {
        Origin: "https://attacker.example",
        Cookie: `${COOKIE_NAME}=placeholder-session`,
        "X-Forwarded-Host": "attacker.example",
        "X-Forwarded-Proto": "https",
        "Content-Type": "application/json",
      },
      body: "{}",
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("x-hktube-security-decision")).toBe("BLOCK");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("allows preflight only for an explicitly trusted origin", async () => {
    const allowed = await fetch(`${baseUrl}/api/media-upload/presign`, {
      method: "OPTIONS",
      headers: { Origin: "https://trusted.example", "Access-Control-Request-Method": "POST" },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://trusted.example");

    const denied = await fetch(`${baseUrl}/api/media-upload/presign`, {
      method: "OPTIONS",
      headers: { Origin: "https://attacker.example", "Access-Control-Request-Method": "POST" },
    });
    expect(denied.status).toBe(403);
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });
});
