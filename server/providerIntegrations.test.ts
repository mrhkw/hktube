import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { providerStatus, verifyMuxWebhook } from "./providerIntegrations";

describe("provider integration safety", () => {
  it("accepts a current Mux signature and rejects a stale signature", () => {
    vi.stubEnv("MUX_WEBHOOK_SECRET", "unit-test-secret");
    const body = JSON.stringify({ id: "evt_1", type: "video.asset.ready" });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", "unit-test-secret").update(`${timestamp}.${body}`).digest("hex");
    expect(verifyMuxWebhook(body, `t=${timestamp},v1=${signature}`)).toBe(true);
    expect(verifyMuxWebhook(body, `t=${Number(timestamp) - 301},v1=${signature}`)).toBe(false);
  });

  it("reports only non-secret readiness flags and does not expose DATABASE_URL state", () => {
    vi.stubEnv("MUX_TOKEN_ID", "configured");
    vi.stubEnv("MUX_TOKEN_SECRET", "configured");
    const status = providerStatus();
    expect(status.mux).toBe(true);
    expect(status).not.toHaveProperty("database_url");
    expect(status).not.toHaveProperty("supabase_admin");
  });
});
