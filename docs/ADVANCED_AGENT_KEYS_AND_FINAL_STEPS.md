# HkTube Advanced Agent: Required Setup and Verification

This checklist is for the guarded runtime coding tools. Never paste credentials into chat, source code, GitHub issues, or pull-request descriptions. Add them only in Vercel Project Settings → Environment Variables, then redeploy the relevant environment.

## Required for runtime GitHub coding

1. `GITHUB_TOKEN` — a GitHub fine-grained personal access token restricted to the single repository `mrhkw/hktube`.
   - Repository permissions: **Contents: Read and write**, **Pull requests: Read and write**, **Metadata: Read-only**.
   - Do not grant organization administration, secrets, Actions, deployments, or unrelated repositories.
   - This enables reading source, creating an isolated `ai-agent/*` branch, committing eligible source files, and opening a **draft PR**. It does not merge PRs or deploy production.
2. `HKTUBE_GITHUB_REPO` — set to `mrhkw/hktube`. Optional because the code defaults to this repository.
3. `HKTUBE_GITHUB_BASE_BRANCH` — set to `main`. Optional because the code defaults to `main`.

The coding tools intentionally block writes to `.env*`, `.github/workflows/*`, `vercel.json`, `package.json`, and package lockfiles. Source edits are committed only to a branch with the `ai-agent/*` prefix. PRs are created as drafts and require human review. The agent does not merge or claim that a PR is a production deployment.

## Required AI model configuration

At least one server-side model provider must be configured for the HkTube agent: `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `BUILT_IN_FORGE_API_KEY`. Keep any existing working provider configuration; do not create duplicate variables or replace a working key without checking the current Vercel settings.

## Optional media and observability providers (not required for coding tools)

- Mux: `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`
- Deepgram: `DEEPGRAM_API_KEY`
- Hive moderation: `HIVE_API_KEY`
- Upstash rate limiting: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Sentry error reporting: `SENTRY_DSN`
- Server-side Supabase operations: `SUPABASE_SERVICE_ROLE_KEY` (highly privileged; never expose to browser code)

These are separate from the GitHub coding agent. Missing providers must remain visibly blocked instead of being reported as working.

## Final verification after saving keys

1. Save the GitHub token and required model key only in Vercel Environment Variables for the intended environment.
2. Redeploy a preview first.
3. In HkTube Admin Agent, ask it to check repository status and read `server/_core/aiAgent.ts`. Confirm it reports a verified repository and base commit.
4. Ask for a small harmless source change. Confirm it creates an `ai-agent/*` branch and a draft PR, without touching `main`.
5. Inspect the draft PR and its Vercel preview. Confirm the build and automated tests in actual CI; a Vercel READY status alone proves only that the deployment build became ready.
6. Merge manually only after reviewing the diff and successful checks. Production changes are not considered complete until the production deployment and live behavior are verified.

## Current capability boundary

The runtime GitHub integration performs repository status/read, isolated branch creation, eligible source-file commits, and draft PR creation. It does not run arbitrary shell commands or tests inside the HkTube server, merge PRs, edit protected configuration files, or deploy production directly. CI/Vercel preview verification remains the proof step for each code change.
