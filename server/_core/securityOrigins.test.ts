import { describe, expect, it } from "vitest";
import { configuredSecurityOrigins, isAllowedSecurityOrigin } from "./securityOrigins";

describe("server-side security origin allowlist", () => {
  it("allows only explicit origins and trusted Vercel deployment hostnames", () => {
    const env = {
      NODE_ENV: "production",
      ALLOWED_ORIGINS: "https://creator.example, https://admin.example/",
      VERCEL_URL: "hktube-preview.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "hktube.example",
    };

    expect(isAllowedSecurityOrigin("https://creator.example", env)).toBe(true);
    expect(isAllowedSecurityOrigin("https://hktube-preview.vercel.app", env)).toBe(true);
    expect(isAllowedSecurityOrigin("https://hktube.example", env)).toBe(true);
    expect(isAllowedSecurityOrigin("https://attacker.example", env)).toBe(false);
    expect(configuredSecurityOrigins(env).has("https://attacker.example")).toBe(false);
  });

  it("does not accept malformed, credential-bearing, or pathful entries", () => {
    const env = {
      NODE_ENV: "production",
      ALLOWED_ORIGINS: "https://trusted.example/path, https://user:pass@other.example",
    };

    expect(isAllowedSecurityOrigin("https://trusted.example/path", env)).toBe(false);
    expect(isAllowedSecurityOrigin("https://user:pass@other.example", env)).toBe(false);
    expect(isAllowedSecurityOrigin("null", env)).toBe(false);
    expect(isAllowedSecurityOrigin("javascript:alert(1)", env)).toBe(false);
  });

  it("includes localhost origins only outside production", () => {
    expect(isAllowedSecurityOrigin("http://localhost:5173", { NODE_ENV: "development" })).toBe(true);
    expect(isAllowedSecurityOrigin("http://localhost:5173", { NODE_ENV: "production" })).toBe(false);
  });
});
