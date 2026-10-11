# HkTube Agent Reliability Audit — 2026-10-11

## Scope

Reviewed the existing HkTube Agent runtime, AI provider routing, Supabase memory/history paths, automation queue/watchdog migrations, owner authorization, and deployment configuration. The working system was preserved.

## Findings and fixes

| Area | Finding | Severity | Fix/status |
|---|---|---:|---|
| Durable memory | Model-suggested memories were persisted without an explicit user request. | High | Fixed: persistence now requires an explicit remember/save phrase and the Agent memory toggle must be ON. |
| Memory secrets | Memory writes did not reject credential-like keys or secret-shaped values. | High | Fixed: server-side secret pattern filtering and value-size bound added. |
| Memory provenance | Memory rows had no origin marker. | Medium | Fixed: `provenance` column and index added; new confirmed memories use `user_confirmed`. |
| Memory relevance | Up to 30 recent memories were injected for every request, regardless of task. | Medium | Fixed: query-term relevance filtering with a small bounded fallback. |
| Cross-user isolation | Memory/history requests derive identity from the verified Supabase bearer token and query by that verified subject. | High | Preserved and covered by existing ownership paths. |
| Provider reliability | Groq/Gemini/OpenAI routing already had bounded deadlines, retry/backoff, 429 handling, and fallback tests. | High | Preserved; existing outage/fallback tests pass. |
| Research trust | Search results are treated as untrusted context and source metadata is persisted/displayed. | High | Preserved; no fabricated source claims added. |
| Automation | Queue dedupe, leases/watchdog, cron watchdog, kill-switches and approval gates already exist. | High | Preserved; no false claim of a resident Vercel worker. |

## Migration

- `supabase/migrations/20261011153000_harden_ai_memory_consent_provenance.sql`
- Applied successfully to Supabase project `jpdvunotyykfqmmkhmml`.

## Verification

- TypeScript check: passed.
- Focused reliability tests: passed.
- Full prior suite baseline: 72 tests passed.
- After this patch: 74 tests passed in the focused/full Vitest invocation.
- Production build: must be rerun after the final toggle patch before deployment.

## Remaining infrastructure requirement

Vercel serverless functions are not an indefinite resident worker. Supabase cron currently provides watchdog/scheduled-publication database processing, while model/tool jobs remain bounded and approval-gated. A true always-on browser/computer worker would require an authorized persistent runtime and isolated browser service; it should not be simulated with browser timers.

## Security position

No API keys, service-role keys, bearer tokens, or private provider errors are sent to the browser. External pages, uploaded media, and tool output remain untrusted input. Consequential actions continue to require explicit approval and audit logging.
