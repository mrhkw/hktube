# HkTube Admin AI / 31-Team Runtime — Implementation Status

**As of:** 2026-10-04
**Local branch:** `codex/31-category-agent-system-20261003`
**Base:** `origin/main` at `9d405ce` (`Unify mobile navigation on primary pages (#18)`)
**Production:** unchanged; no migration or production deployment was run.

## Implemented in the local worktree

- Server-side Supabase token verification for the exact two canonical Gmail admins. The private Admin Agent route and runtime endpoints enforce the allowlist independently of client-side route visibility.
- The private `/admin-agent` page now calls its dedicated `POST /api/admin-agent/chat` backend rather than the general HkTube AI chat endpoint. It retries auth once with a refreshed Supabase session and offers an explicit approved-account switch/reconnect path.
- The HkTube AI client sends a Supabase bearer token directly to `/api/ai/chat`, refreshes once on an auth rejection, and exposes a Gmail reconnect path rather than surfacing a legacy `Please login (10001)` error.
- Safe post-login route restoration and Android WebView Google-login handoff to Chrome. Native Android intent handling accepts only a Chrome intent targeting the exact HkTube HTTPS host and validates the HTTPS App Link callback host.
- The 31-team catalog, runtime permission/state engine, service-role-only Supabase store, additive migration, durable idempotent queue/lease functions, audit/notification records, integration checks, and a protected runtime dashboard at `/admin/ai/runtime`.
- The only registered task executors are `content-writer:draft-content`, `content-writer:summarize-content`, and `translator-voice:translate-text`. They produce schema-validated drafts/translations, not external side effects. Other teams are catalog entries, not running agents.

## Verification performed

- `pnpm check` — passed.
- `pnpm test` — passed: **17 test files, 67 tests**.
- `pnpm build` — passed. Generated `api/index.js` / `api/storage.js` bundles were restored after the check; only source, migration, tests and documentation remain as changes.
- The Supabase migration was executed in an isolated temporary PostgreSQL WASM database (not the connected production project). Checks passed for 31 seeded teams, zero initially enabled teams, 10 RLS-protected tables, anon/authenticated table and snapshot-RPC denial, `service_role` snapshot access, idempotent enqueue, verified-success enforcement, and blocked/audited/notified work after a team is disabled. A second isolated regression run also checks that expired 15-minute AI-provider probes block activation and queued-task claims.
- `git diff --check` — passed. No `.env` file or real Gemini/service-role key was added.

## Not configured or not verified

- **No live Gemini key is configured in this workspace.** `YAHAN_APNI_GEMINI_KEY_LIKHEIN` was a placeholder, not a key. Do not paste a real key into chat or commit it.
- **No `SUPABASE_SERVICE_ROLE_KEY` is configured**, and the new migration has not been applied to production Supabase. Therefore the persisted runtime remains **BLOCKED** until the owner configures the server-only credential and applies the reviewed migration through the authorized workflow.
- No continuous 24/7 worker, cron endpoint, or scheduler is configured. “Process one task” is a bounded admin-triggered request only.
- The other 29 teams' actions, arbitrary file/code editing, GitHub pushes, deployments, publishing, payments, moderation deletions and other external side effects are not implemented/enabled.
- The Android project could not be compiled here: this workspace has no Gradle, JDK, or Android SDK. The Android App Links file and final release signing-certificate fingerprint are absent. Until the release owner publishes a correct `/.well-known/assetlinks.json`, Google login completes in Chrome and Chrome's Supabase session is **not** shared with the embedded WebView.
- Phases 2–6 in the approved plan remain future work. External integrations, webhooks, persistent workers, approval actions, event sources and their credentials must be independently configured and verified before their teams can become active.

## Publication gate

`https://github.com/mrhkw/hktube` is public. These changes are currently local on the feature branch and have **not** been pushed as a public branch, merged to `main`, or deployed. The approved phased plan requires explicit release approval before publication to production `main`; production also lacks the required service-role key/migration. Do not treat a successful local build or isolated SQL test as a production release.

## Next safe steps

1. Configure the real `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` through server-only hosting settings; never use a `VITE_` prefix for either.
2. Apply and verify the reviewed migration in the authorized Supabase environment.
3. If in-app Google OAuth return is required, use the final Android release signing certificate to publish and verify Digital Asset Links; otherwise continue using Chrome after sign-in.
4. Review the exact code diff and obtain the plan-required release approval before publishing to the public repository or production `main`.
5. Continue with the next integration phase only after its data source, provider permission, approval rules and actual execution environment are available.
