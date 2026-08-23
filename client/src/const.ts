import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// These two values identify the public OAuth client. They are not credentials.
// Vercel should still inject both values at build time, but the fallback prevents
// a missing public build variable from generating the invalid "undefined/app-auth"
// URL that previously blocked production sign-in.
export const MANUS_OAUTH_PORTAL_FALLBACK = "https://manus.im";
export const MANUS_APP_ID_FALLBACK = "oW2FhxeMWaMQ3fzfsPSX4q";

export function getOAuthLoginConfig(
  portalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL,
  appId = import.meta.env.VITE_APP_ID
) {
  return {
    oauthPortalUrl: (portalUrl || MANUS_OAUTH_PORTAL_FALLBACK).replace(/\/+$/, ""),
    appId: appId || MANUS_APP_ID_FALLBACK,
  };
}

// Open HkTube's own first-party authentication page. Keep this side-effectful
// action in event handlers rather than render so navigation is predictable.
export const startLogin = () => {
  window.location.href = "/auth";
};
