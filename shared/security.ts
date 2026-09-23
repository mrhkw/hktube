/**
 * Escape user-authored text before it crosses a persistence or rendering boundary.
 * React still safely escapes text nodes; this helper protects HTML-bearing consumers
 * and keeps the server/client validation behavior identical.
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}

export function sanitizeOptionalInput(input: string | null | undefined): string | null {
  if (input == null) return null;
  const sanitized = sanitizeInput(input);
  return sanitized || null;
}

export function sanitizeUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const url = new URL(input.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function validateVideoUrl(url: string): boolean {
  return sanitizeUrl(url) !== null;
}

export const SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Cross-Origin-Resource-Policy": "same-site",
  "Origin-Agent-Cluster": "?1",
  "X-Permitted-Cross-Domain-Policies": "none",
} as const;

export const CONTENT_SECURITY_POLICY =
  "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.manus.im; object-src 'none'; worker-src 'self' blob:; manifest-src 'self'";

export function applySecurityHeaders(set: (headers: Record<string, string>) => void) {
  set({ ...SECURITY_HEADERS, "Content-Security-Policy": CONTENT_SECURITY_POLICY });
}

export function applySecurityHeadersToResponse(response: { set: (headers: Record<string, string>) => void }) {
  applySecurityHeaders(headers => response.set(headers));
}

export function applySecurityHeadersToHeaders(headers: { set: (name: string, value: string) => void }) {
  for (const [name, value] of Object.entries({ ...SECURITY_HEADERS, "Content-Security-Policy": CONTENT_SECURITY_POLICY })) {
    headers.set(name, value);
  }
}
