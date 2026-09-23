# HkTube Enterprise Security Audit

## Scope and architecture

The repository is a Vite/Express TypeScript application with two data surfaces: a Drizzle/MySQL application API and a Supabase-backed media/profile/engagement surface. The originally supplied Next.js/Supabase Server snippet does not match this repository, so the implementation was applied to the actual request boundaries rather than introducing unused Next middleware.

## Implemented controls

| Area | Implementation |
|---|---|
| Database hardening | Added `supabase/hktube_security_hardening.sql`. It enables RLS and installs explicit ownership policies for `profiles`, `videos`, `comments`, and whichever likes table exists (`likes` or `video_likes`). Policies use `auth.uid()` for insert/update/delete ownership checks and restrict video visibility to public published records or the owner. |
| HTTP security headers | Express now emits `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, strict referrer and permissions policies, cross-origin isolation headers, HSTS in production, and a CSP with `frame-ancestors 'none'`, `object-src 'none'`, and no inline/eval scripts. Vercel edge headers were aligned with the same policy. |
| Input sanitization | Added `shared/security.ts` and applied `sanitizeInput()` to tRPC video titles/descriptions, comments, posts, channel names/descriptions, Supabase video writes, Supabase comments/reports, channel profile updates, account registration names, and the profile bio update helper. |
| API authorization | Upload/presign and all protected tRPC mutations require a valid session. Video deletion now permits only the authenticated owner or an authorized admin; channel/profile updates remain owner-scoped. |
| Operational protections | Existing request-origin checks, rate limits, request size limits, safe media URL validation, and upload content-type/extension/size checks remain enabled. |

## Verification

The following checks passed after the final changes:

- TypeScript: `pnpm check` — passed.
- Tests: `pnpm test -- --reporter=verbose` — **7 test files, 22 tests passed**.
- Production build: `pnpm build` — passed.
- Local production health: `GET /api/health` returned **HTTP 200** with `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, strict CSP, and HSTS.
- Git delivery: commits `b48beb5` and `3661c22` were pushed to `origin/main`; the working tree is clean.

## Deployment note

The Supabase migration is committed but was not executed against the remote database because no Supabase database execution credential or migration connector was available in this session. It must be run in the Supabase SQL Editor or through the project migration pipeline before relying on the database-side controls in production.

The public `https://hktube.vercel.app/` endpoint returned HTTP 200 during verification, but its response still referenced the prior asset deployment and did not yet expose the new edge headers. The Vercel MCP connector required a separate login and the Vercel CLI was not installed, so production rollout status could not be forced or independently inspected from this session. After Vercel completes the push-triggered deployment, re-check `/api/health` and `/` for the strict headers above.
