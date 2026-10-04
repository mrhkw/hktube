import { describe, expect, it } from "vitest";
import { buildAndroidChromeIntent, getSafePostLoginPath } from "./authFlow";

describe("auth return paths", () => {
  it("allows only intended local app destinations", () => {
    expect(getSafePostLoginPath("?next=%2Fai")).toBe("/ai");
    expect(getSafePostLoginPath("?next=%2Fadmin-agent")).toBe("/admin-agent");
    expect(getSafePostLoginPath("?next=%2Fadmin%2Fai%2Fruntime")).toBe("/admin/ai/runtime");
    expect(getSafePostLoginPath("?next=https%3A%2F%2Fevil.example")).toBe("/menu");
    expect(getSafePostLoginPath("?next=%2F%2Fevil.example")).toBe("/menu");
    expect(getSafePostLoginPath("")).toBe("/menu");
  });

  it("creates an Android Chrome intent for the same-origin HTTPS login URL", () => {
    const target = new URL("https://hktube.vercel.app/auth?next=%2Fadmin-agent&reauth=1");
    expect(buildAndroidChromeIntent(target, "https://hktube.vercel.app")).toBe("intent://hktube.vercel.app/auth?next=%2Fadmin-agent&reauth=1#Intent;scheme=https;package=com.android.chrome;end");
  });

  it("refuses to forward the sign-in intent to a different origin", () => {
    expect(() => buildAndroidChromeIntent(new URL("https://attacker.example/login"), "https://hktube.vercel.app")).toThrow(/secure HkTube origin/);
  });
});
