# HkTube Admin AI and 31-Team Runtime Setup

## Private Admin Agent access

The hidden `/admin-agent` route and `POST /api/admin-agent/chat` endpoint allow only these exact canonical Supabase Auth emails:

- `hanifnazamdin30@gmail.com`
- `hanifnazamdin6@gmail.com`

The server validates each Supabase bearer token against Supabase Auth and checks the email allowlist independently. Hiding the route in the browser is not the security boundary. Google sign-in must be enabled in Supabase, and its allowed redirect URLs must include the production HkTube origin. The Admin Agent page calls the dedicated `/api/admin-agent/chat` endpoint; it does not use the public HkTube AI endpoint.

The Admin Agent is a **read-only coding copilot**. It can draft guidance and patch suggestions, but has no repository filesystem, shell, GitHub write, or deployment access. It must not claim it saved code or deployed anything.

## Android Google login

Google blocks OAuth sign-in inside many embedded Android WebViews. The HkTube Android button therefore launches a same-origin HTTPS login URL in Chrome. The native WebView only accepts the app's exact trusted HTTPS host for the Chrome intent and App Link callback.

Chrome and the installed WebView have separate browser storage. Returning an authenticated session to the native app requires Android App Links verification. The repository does **not** contain the final signing-certificate fingerprint or a production `/.well-known/assetlinks.json`, so automatic app handoff is not verified yet. Until the release owner publishes the correct association file, continue using HkTube in Chrome after Google login; do not assume the embedded app session is shared. Do not invent a signing fingerprint.

## Required server environment

The request that originally supplied `YAHAN_APNI_GEMINI_KEY_LIKHEIN` supplied a placeholder, not a usable credential. No real key or `.env` file was committed, and no live Gemini key is configured in this workspace.

Configure real values in the hosting provider's **server-side** environment-variable settings:

- `GEMINI_API_KEY` — required for the private Admin Agent's Gemini endpoint.
- `SUPABASE_SERVICE_ROLE_KEY` — required for persisted 31-team runtime state and RPCs. Keep it server-only; never use a `VITE_` prefix.
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` — optional explicit server overrides; the existing public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values are used for identity verification when overrides are absent.
- Runtime executors can use configured `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, or the existing built-in provider key. A key's presence is only `CONFIGURED`, not a successful connection.

For local development, copy `.env.example` to `.env`, use real credentials from the owners' provider dashboards, and keep `.env` out of Git. Never paste credentials into the Admin Agent chat. Rotate any key accidentally exposed in a message or commit.

## 31-team runtime migration and actual capability

Apply `supabase/migrations/20261003_ai_runtime_foundation.sql` through the authorized Supabase migration workflow only after review. It is additive and creates runtime teams/agents, events, tasks, approvals, audit, integrations, notifications, memories and health tables, service-role-only RPCs, RLS, and 31 catalog seeds. All teams seed as `DRAFT`/disabled; a catalog entry is not a running agent. The migration has **not** been applied to the connected production Supabase project from this workspace.

After configuring `SUPABASE_SERVICE_ROLE_KEY` and applying the migration, the private `/admin/ai/runtime` page can query persistent state. Its only actual task executors are:

- `content-writer:draft-content`
- `content-writer:summarize-content`
- `translator-voice:translate-text`

Those outputs are drafts; publishing, website-file writes, GitHub pushes, deployment, email/social sends, payments, moderation deletion and the other 28 teams' actions are not implemented. The two low-risk text teams can be explicitly enabled only after a recent successful provider probe and required integration checks. Provider probes expire after 15 minutes; an environment key without a successful probe remains unverified. High-risk team activations use separate approval paths and remain blocked.

## Runtime and release limits

The current Vercel application uses request-scoped serverless functions. No continuous 24/7 worker, cron route, or scheduler is configured in this branch. “Process one task” is an admin-triggered, single-task request, not an autonomous background worker. Do not create a recurring heartbeat or imply continuous execution without a verified persistent worker and supported scheduler.

Production release is a separate gate. The reviewed migration has not been run in production, and this branch must not be merged/pushed to production `main` until its release gate is explicitly approved. Verify the exact migration, environment-variable presence (never values), deployment commit, runtime health and allowlist behavior after any approved release.
