const ALLOWED_POST_LOGIN_PATHS = new Set(["/menu", "/ai", "/admin-agent", "/admin/ai", "/admin/ai/runtime"]);
const AUTH_RETURN_STORAGE_KEY = "hktube:post-auth-path";

export function getSafePostLoginPath(search: string): string {
  const next = new URLSearchParams(search).get("next");
  return next && ALLOWED_POST_LOGIN_PATHS.has(next) ? next : "/menu";
}

export function rememberPostLoginPath(path: string): void {
  if (!ALLOWED_POST_LOGIN_PATHS.has(path)) return;
  try { sessionStorage.setItem(AUTH_RETURN_STORAGE_KEY, path); } catch { /* Some private browsers disable session storage. */ }
}

export function takeRememberedPostLoginPath(): string | null {
  try {
    const path = sessionStorage.getItem(AUTH_RETURN_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_RETURN_STORAGE_KEY);
    return path && ALLOWED_POST_LOGIN_PATHS.has(path) ? path : null;
  } catch { return null; }
}

/** Open a same-origin HTTPS login URL in Chrome from Android WebViews, where Google blocks embedded OAuth. */
export function buildAndroidChromeIntent(target: URL, currentOrigin = window.location.origin): string {
  const origin = new URL(currentOrigin);
  if (target.origin !== origin.origin || (target.protocol !== "https:" && target.hostname !== "localhost")) {
    throw new Error("Android sign-in can only open the secure HkTube origin.");
  }
  return `intent://${target.host}${target.pathname}${target.search}${target.hash}#Intent;scheme=${target.protocol.replace(":", "")};package=com.android.chrome;end`;
}
