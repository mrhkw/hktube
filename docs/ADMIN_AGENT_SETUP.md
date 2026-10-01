# Admin AI Agent setup

## Access controls

The hidden `/admin-agent` page and `POST /api/admin-agent/chat` endpoint are restricted to these exact, verified Google-authenticated Supabase accounts:

- `hanifnazamdin30@gmail.com`
- `hanifnazamdin6@gmail.com`

The backend independently verifies the Supabase access token against Supabase Auth and checks the verified email and Google provider. Hiding the route in the client is only a UI measure; the server check is authoritative. The page is intentionally not linked from public navigation.

Google sign-in must already be enabled for the Supabase project. The browser should use the project's existing public Supabase URL and anon/publishable key. The API reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` build variables) to verify sessions.

## Gemini configuration

The key supplied in the setup request (`YAHAN_APNI_GEMINI_KEY_LIKHEIN`) is a placeholder, not a usable API key. No `.env` file or fake secret was committed.

For local development, copy `.env.example` to `.env` and set a real `GEMINI_API_KEY` obtained from Google AI Studio. Keep `.env` out of Git. For production, add `GEMINI_API_KEY` as a **server-side Vercel environment variable** for the relevant deployment environments, then redeploy. Optionally configure `GEMINI_MODEL`; the default is `gemini-2.5-flash`. Never use a `VITE_` prefix for the Gemini key.

The existing Google OAuth login remains managed by Supabase; no Google OAuth client secrets are needed in this repository. Supabase's Google provider and authorized redirect URLs must be configured in the Supabase dashboard.

## Operational boundary

This is a request-driven Vercel serverless chat endpoint, not a 24/7 process. Vercel functions do not provide a persistent writable repository workspace: their filesystem is ephemeral/read-only for deployment artifacts, and a request cannot make a durable source change or deploy the result. The copilot therefore returns code suggestions/diff drafts for a human to review and apply. It has no GitHub write token, shell execution, autonomous filesystem editing, or deployment capability. Granting a live web endpoint repository-write/deployment credentials would need a separate, carefully scoped design (for example, proposed PRs with protected-branch review), rather than silent commits to `main`.

Chat messages remain in the current browser page session and are sent only to the server endpoint and Gemini; do not paste credentials, personal data, or secrets into prompts.
