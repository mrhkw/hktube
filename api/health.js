// This file is a standalone Vercel function and does not pass through the
// Express security middleware. Keep these headers aligned with
// shared/security.ts and vercel.json.
const HEALTH_SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.manus.im; object-src 'none'; worker-src 'self' blob:; manifest-src 'self'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Cross-Origin-Resource-Policy": "same-site",
  "Origin-Agent-Cluster": "?1",
  "X-Permitted-Cross-Domain-Policies": "none",
};

module.exports = function healthHandler(_req, res) {
  res.set(HEALTH_SECURITY_HEADERS);
  res.status(200).json({
    ok: true,
    service: "hktube",
    timestamp: new Date().toISOString(),
  });
};
