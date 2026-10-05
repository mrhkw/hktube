# HkTube API Inventory

**Version:** 2026-10-05  
**Purpose:** Release-gate inventory for authentication, authorization, rate limiting, input validation, logging, and deprecation review.

| Surface | Method | Auth boundary | Primary controls | Sensitive behavior |
|---|---|---|---|---|
| `/api/health` | GET | Public | No secrets; provider readiness only | Do not add credentials or raw errors |
| `/api/providers/health` | GET | Public | Boolean readiness plus non-secret health counters | No provider secrets or raw error payloads |
| `/api/providers/mux/assets` | POST | Supabase bearer + creator ownership | JSON body limit, auth, ownership check, private-before-processing | Creates provider asset; idempotent by existing asset |
| `/api/admin/moderation/enforce` | POST | Supabase bearer + `profiles.role=admin` | Admin authorization, JSON body limit, deterministic command allowlist, audit RPC | High-impact reversible soft removal |
| `/api/webhooks/mux` | POST | Mux HMAC signature | Raw-body HMAC, timestamp tolerance, duplicate suppression, ordered-event record, stale-event ignore, 2 MB limit | Provider callback; never trust payload fields |
| `/api/media-upload` | POST | Existing application/session auth | Origin/security middleware, body and rate limits | Upload remains private until processing/moderation |
| `/api/admin-agent/*` | Existing | Admin identity guard | Admin limiter and Sentry-safe errors | Internal AI recommendation; never automatic authority |
| `/api/ai/*` | Existing | Application auth | AI limiter, provider fallback/error guardrails | Never expose provider secrets or untrusted markup |

## Release gates

- Every new route must add one row here before merge.
- Every identifier must be loaded under authenticated ownership/role scope.
- Every state-changing browser request must pass origin/CSRF checks.
- Every provider callback must verify raw-body authenticity before parsing.
- Every expensive operation must have a rate-limit class, timeout, retry budget, and idempotency key.
- Every sensitive response must be `private`/`no-store` unless a reviewed cache contract says otherwise.
- Logs and Sentry events must not contain tokens, cookies, signatures, raw media, raw transcripts, or secrets.
