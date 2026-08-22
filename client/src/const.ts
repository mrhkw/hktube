import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

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

// Start the Manus OAuth login. Call this from an event handler or effect at the
// moment you want to navigate, e.g. `onClick={() => startLogin()}`.
//
// It has SIDE EFFECTS — it mints a one-time nonce, writes the __Host- state
// cookie, and navigates immediately — so the cookie nonce always matches the
// `state` it sends. Do NOT call it during render (no `href={startLogin()}` /
// `loginUrl={...}`): each call overwrites the cookie, so a stray render-phase
// call would desync it from an in-flight login and the callback would reject it
// with "invalid oauth state". It returns void by design, so there is no URL to
// stash across renders.
export const startLogin = () => {
  const { oauthPortalUrl, appId } = getOAuthLoginConfig();
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  const nonce = crypto.randomUUID();
  const secure = window.location.protocol === "https:";
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=${secure ? "None" : "Lax"}${secure ? "; Secure" : ""}`;
  const state = encodeOAuthState({ redirectUri, nonce });

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  window.location.href = url.toString();
};
