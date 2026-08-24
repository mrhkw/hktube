# HkTube release report

## Release status

HkTube is live on Vercel from GitHub commit `78c9ccb1a57ef45a5186ca8bcd8dff8d11506983`. The latest production deployment is READY at https://hktube-ohudj2xom-hktube.vercel.app, with the canonical aliases https://hktube.vercel.app and https://hktube-hktube.vercel.app.

## Implemented in this release

The first-party Supabase email/password session is now forwarded to the tRPC backend as a bearer token. The server verifies Supabase JWTs through the project JWKS and falls back to the Supabase Auth user endpoint for older signing modes when the public anon key is configured. Each successful session is synchronized to a stable HkTube MySQL user row using `supabase:{auth-user-id}` as the internal identity key. The existing two-owner Gmail allowlist still controls admin procedures.

Authenticated users can now create videos and Shorts only for channels they own. Media uploads use the current Supabase session rather than the retired Manus preview token. The media endpoint is `/api/media-upload`; upload size and MIME-type validation remain enforced. Destructive catalog removal and admin listing remain owner-only.

The Posts/Feeds surface now includes a real database-backed composer for signed-in users. The watch page now supports real Like, Share, comment, and Watch Later/Save actions against the existing HkTube tables. No demo thumbnails, fabricated view counts, or mock engagement records were added.

Creator Studio now contains a provider-gated AI metadata copilot. It accepts the uploader’s real working title, description, optional authorized link, and content category, then requests structured suggestions for title, description, tags, and review checks. The assistant is advisory only; it does not publish content or invent claims. If the project LLM provider is not configured, the UI reports that honestly.

The owner-only Algorithm route is available at `/algorithm`. It displays real catalog, report, and audit-log data and has a safe check runner that records an audit event. It intentionally does not auto-publish, delete content, file copyright claims, or contact external rights services without a separate verified workflow.

## Validation

`pnpm check` passed. `pnpm test` passed with 6 test files and 20 tests. `pnpm build` passed locally. The live homepage returned HTTP 200 and rendered the HkTube full-screen shell. The live `/algorithm` route returned the explicit Owner access only state for an unauthenticated visitor rather than a 404.

## Provider and data requirements

For Supabase synchronization in Vercel, configure `SUPABASE_URL` or `VITE_SUPABASE_URL`, and `SUPABASE_ANON_KEY` or `VITE_SUPABASE_ANON_KEY` for the Auth API fallback. The existing database connection must remain configured through `DATABASE_URL`. The AI copilot requires the project’s server-side built-in LLM variables `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY`; without them it remains an honest integration-required state. Payment payouts, external copyright claims, automated takedowns, and 24-hour background execution are not falsely represented as complete because they require verified provider credentials, policies, and an auditable job runner.
