import { describe, expect, it } from "vitest";
import {
  getOAuthLoginConfig,
  MANUS_APP_ID_FALLBACK,
  MANUS_OAUTH_PORTAL_FALLBACK,
} from "./const";

describe("getOAuthLoginConfig", () => {
  it("uses the public production fallback when Vercel build variables are absent", () => {
    expect(getOAuthLoginConfig(undefined, undefined)).toEqual({
      oauthPortalUrl: MANUS_OAUTH_PORTAL_FALLBACK,
      appId: MANUS_APP_ID_FALLBACK,
    });
  });

  it("keeps configured values and removes a trailing portal slash", () => {
    expect(getOAuthLoginConfig("https://login.example.test/", "app_test")).toEqual({
      oauthPortalUrl: "https://login.example.test",
      appId: "app_test",
    });
  });
});
