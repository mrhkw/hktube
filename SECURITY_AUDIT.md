# HkTube Security, Performance & Settings Review

## Scope

Reviewed the Vite/React client, Express/tRPC API, Supabase integration, settings lifecycle, build output, and deployment configuration. The goal was to make the existing site safer and faster without changing its product surface or removing existing settings.

## Completed in this pass

| Area | Change |
|---|---|
| Settings access | The existing Settings, Privacy, Security, policy, help, and About pages remain intact. The temporary global header menu added during this review was removed from the header as requested; no settings or policy page was deleted. |
| DOM performance | Debounced the global language translation observer and disconnects it while translating, preventing repeated full-document scans during every route mutation. |
| CORS | Uses an exact server-controlled origin allowlist: configured `ALLOWED_ORIGINS`, the canonical production origin, and Vercel deployment host metadata. Incoming `Host` and `X-Forwarded-*` values can no longer make an arbitrary origin trusted. |
| CSRF/origin checks | Cookie-authenticated mutations fail closed on untrusted origins; an Express integration test confirms spoofed `X-Forwarded-Host`/`Proto` headers do not bypass the check. |
| Admin privilege escalation | Public local sign-up now always creates a normal user. Owner-email admin promotion requires a verified Supabase email claim; unverified owner-email syncs are downgraded, and legacy local-account admin roles are denied at the admin middleware. |
| Abuse protection | Added a dedicated 6-attempt / 15-minute local login/register bucket while retaining existing endpoint-specific limits for general, upload, AI, and admin-agent traffic. |
| Transport policy | Added HSTS preload to the production Express and Vercel header policies. |
| Shared-rate-limit outage | Sensitive auth, upload, social, report, AI, provider-job, and admin buckets now return a short `503` when configured Upstash protection fails; public browsing retains the bounded local fallback. |
| Security decision logging | CSRF/path blocks and rate-limit outcomes are machine-readable; security block logs use request IDs and omit raw IPs, cookies, bearer tokens, and bodies. |
| Dependency/CI hardening | Patched the production and development/build dependency graph, including the Vite/Vitest/pnpm toolchain, and pinned audited transitive versions. CI now audits the full graph at every severity threshold and runs a repository secret scan. |

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
- `pnpm test -- --reporter=dot` — **26 test files, 100 tests passed** on the current MFA follow-up branch, including server-side AAL2 denial tests, admin-identity regressions, and Express-level forwarded-header spoofing/CORS tests.
- `pnpm build` — passed; Vite produced route chunks and the server/API bundles.
- `pnpm audit --audit-level low` — passed; **no known vulnerabilities in the full production and development dependency graph** on 2026-10-19.
- `vercel.json` and `package.json` JSON parse — passed.
- Live production `GET /api/providers/health` — HTTP 200 at 2026-10-19 09:02 UTC; response reported Upstash `HEALTHY`, circuit `CLOSED`, and zero failures (last successful operation recorded on 2026-10-18).
- Live production `GET /api/health` — HTTP 200 with CSP, HSTS preload, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, permissions policy, and strict referrer policy.
- Express origin tests — configured preflight returned 204; unknown origin returned 403; forged forwarded-host/proto on a cookie-authenticated mutation returned 403.
- Live production smoke test after merge — `/api/health` 200; trusted-origin preflight 204; forged cross-origin POST with spoofed `X-Forwarded-Host` 403; `/api/providers/health` 200.
- [GitHub Actions main run](https://github.com/mrhkw/hktube/actions/runs/39226878275) — succeeded on merge commit `f840e38`, including full dependency audit, Gitleaks, typecheck, tests, and production build.

## MFA follow-up (review branch only; not yet in production)

The `security/mfa-step-up-2026-10-20` branch reads the signed Supabase `aal` claim only after asymmetric JWT signature verification against the project JWKS. It requires AAL2 for media-upload presigns, video create/delete, channel create/update, creator posts, tRPC admin actions, and direct admin AI/verification endpoints. The sign-in flow routes accounts with an enrolled factor to Security Center; the user can verify a fresh challenge there. Legacy HkTube sessions deliberately cannot satisfy these high-impact gates.

Local verification on this branch: `pnpm check`, the full 100-test suite, `pnpm audit --audit-level low`, and `pnpm build` passed. GitHub Actions `verify` succeeded on code commit `fe2259a` ([run 39356094470](https://github.com/mrhkw/hktube/actions/runs/39356094470)). The Vercel PR preview [`hktube-hxz6llser-hktube.vercel.app`](https://hktube-hxz6llser-hktube.vercel.app) reached `READY`; preview smoke tests returned `/api/health` 200 with security headers, `/api/providers/health` 200, trusted preflight 204, and forged-origin mutation 403 despite spoofed forwarded-host/proto headers. No authenticated live MFA challenge was run, and this is a preview only—not production. Before merge, verify a real test account on the preview and confirm the Supabase project uses an asymmetric signing key exposed through its JWKS endpoint. If it still uses a legacy HS256 key, the AAL2 gate fails closed for high-impact actions until signing-key migration; ordinary login remains available.

## Remaining production risks / follow-up

1. Upstash/Redis is configured and reported healthy on production at verification time. The existing local fallback still serves non-sensitive public traffic and is not a distributed limiter; keep the shared store configured and monitor its health.
2. Legacy stateless bearer/session tokens can remain valid until expiry if copied; short-lived access tokens with rotated/revocable refresh sessions would be stronger.
3. Settings and privacy preferences are currently device-local `localStorage` values. Account-level sync and server-enforced privacy controls require a preferences table plus RLS and query/mutation enforcement.
4. Supabase migration/RLS deployment state must be verified against the live project; committed SQL is not proof that production has executed it.
5. The SPA updates SEO metadata client-side. Public channel/video pages should eventually be prerendered or server-rendered for crawler-visible route metadata.
6. The response CSP should be validated against every intentionally enabled third-party feature in production (especially optional advertising and embedded media) before enabling those integrations broadly.
7. Current direct-upload flow validates declared MIME, extension, and declared size; it still does not inspect file signatures or prove malware scanning/quarantine before publish. A safe scanner/processing pipeline must be verified before claiming those controls.
8. `CHALLENGE`/CAPTCHA, passkeys, stronger revocable-device-session checks, and two-account live authorization tests remain follow-up work. TOTP/AAL2 enforcement is in the review branch above, not production; Supabase passkeys are experimental and require separate project-level RP-ID/origin configuration.
9. This is not a full OWASP ASVS 5.0.0 / OWASP Top 10 / API Top 10 assessment. A focused admin-role escalation regression is now covered, but no complete two-account IDOR/BOLA matrix or external penetration test was performed.
10. Vercel production environment metadata did not list `OWNER_OPEN_ID`. If the owner signs in through the custom/Manus OAuth session rather than a verified Supabase identity, admin access will intentionally fail closed until the exact trusted subject is configured as `OWNER_OPEN_ID`.
11. Vercel marks the legacy `SUPABASE_KEY` variable with a `readable-secret` security issue; the repository code does not reference that variable and its Vercel comment says it is deprecated. It was not deleted because external build/deployment consumers were not independently verified; review and remove/rotate it in Vercel.
12. A GitHub push response before merge reported **158 vulnerability alerts on the default branch** (6 critical, 54 high, 85 moderate, 13 low). The current GitHub token cannot enumerate alert details. The merged dependency graph passed the full `pnpm audit` in CI, but recheck the GitHub alert dashboard now that the default branch has updated to confirm its alert inventory refreshed.

## Rollout status

PR #42 was squash-merged into `main` on 2026-10-19 at merge commit `f840e38a6b49f065a8751e4ec00578418f79c314`. The [Vercel production deployment](https://hktube-7lkorctc4-hktube.vercel.app) is `READY` and includes the `hktube.vercel.app` alias. The live health, response-header, trusted-preflight, and forged-origin smoke checks above passed. These checks confirm the deployed controls responded as expected; they do not prove the site is impossible to hack or provide 100% attack prevention.

The live Supabase RLS state, user-account isolation, and full upload-processing pipeline still require authorized staging credentials and non-destructive integration tests. A successful source build does not establish that a website is impossible to hack or guarantee 100% attack prevention.
