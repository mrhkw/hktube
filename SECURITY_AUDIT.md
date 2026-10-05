# HkTube Security, Performance & Settings Review

## Scope

Reviewed the Vite/React client, Express/tRPC API, Supabase integration, settings lifecycle, build output, and deployment configuration. The goal was to make the existing site safer and faster without changing its product surface or removing existing settings.

## Completed in this pass

| Area | Change |
|---|---|
| Settings access | The existing Settings, Privacy, Security, policy, help, and About pages remain intact. The temporary global header menu added during this review was removed from the header as requested; no settings or policy page was deleted. |
| DOM performance | Debounced the global language translation observer and disconnects it while translating, preventing repeated full-document scans during every route mutation. |
| CORS | Added an explicit origin allowlist (`ALLOWED_ORIGINS`, defaulting to `https://hktube.vercel.app` plus the current request origin), credential-safe response headers, and rejected unknown preflight origins. |
| CSRF/origin checks | Preserved the existing fail-closed mutation origin gate and kept forwarded-origin behavior bounded by same-origin checks and the explicit CORS policy. |
| Abuse protection | Added a dedicated 6-attempt / 15-minute local login/register bucket while retaining existing endpoint-specific limits for general, upload, AI, and admin-agent traffic. |
| Transport policy | Added HSTS preload to the production Express and Vercel header policies. |

## Existing controls confirmed

- Supabase bearer sessions are preferred over stale legacy cookies when both are present.
- Cookie-authenticated mutations require a trusted same-origin `Origin` or `Referer`.
- `HttpOnly`, path-scoped session cookies are used; secure HTTPS requests use secure cookies.
- Server-side input sanitization and URL validation are applied across the major video, comment, profile, channel, report, and account write paths.
- Upload/presign and protected tRPC mutations require authentication and ownership checks.
- Security headers include frame denial, MIME sniffing protection, strict referrer policy, permissions policy, cross-origin isolation controls, and CSP.
- Client routes are lazy-loaded and utility UI is deferred; media cards generally use lazy loading and async decoding.
- Supabase RLS hardening SQL exists for profile/video/comment/engagement ownership boundaries.

## Verification completed

- `pnpm check` — passed.
- `pnpm test -- --reporter=dot` — **15 test files, 61 tests passed**.
- `pnpm build` — passed; Vite produced route chunks and the server/API bundles.
- `vercel.json` JSON parse — passed.
- `git diff --check` — passed.
- Local production `GET /api/health` — HTTP 200 with CSP, HSTS preload, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Cache-Control: no-store`.
- Local CORS preflight — allowed configured origin returned 204 with credentials-safe headers; unknown origin returned 403.

## Remaining production risks / follow-up

1. The in-memory rate limiter is useful as a fallback but is not shared between Vercel instances. A production abuse-control store such as Upstash/Redis or another atomic shared counter should be added when available.
2. Legacy stateless bearer/session tokens can remain valid until expiry if copied; short-lived access tokens with rotated/revocable refresh sessions would be stronger.
3. Settings and privacy preferences are currently device-local `localStorage` values. Account-level sync and server-enforced privacy controls require a preferences table plus RLS and query/mutation enforcement.
4. Supabase migration/RLS deployment state must be verified against the live project; committed SQL is not proof that production has executed it.
5. The SPA updates SEO metadata client-side. Public channel/video pages should eventually be prerendered or server-rendered for crawler-visible route metadata.
6. The response CSP should be validated against every intentionally enabled third-party feature in production (especially optional advertising and embedded media) before enabling those integrations broadly.

These follow-ups require production credentials, a shared rate-limit provider, or a deployment/migration workflow that was not available in this sandbox.
