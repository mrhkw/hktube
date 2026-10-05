# HkTube Autonomous Comparison Board

**Prepared:** 2026-10-05  
**Scope:** Existing HkTube baseline versus authoritative production benchmarks and verified implementation status.  
**Status vocabulary:** **DONE**, **PARTIAL**, **BLOCKED**, **SKIPPED** only.  
**Completion rule:** No domain is claimed 100% complete without route-level, production, operational, and human-policy evidence.

## Executive summary

HkTube has a real autonomous safety and reliability foundation: deterministic moderation, high-confidence soft removal, creator warnings, provider telemetry/circuit data, queue watchdog, appeals foundation, signed/idempotent webhooks, adaptive rate limits, policy versioning, trusted media egress, API inventory, SLO/incident runbook, moderation decision notices, an audit-chain foundation, and privacy-erasure request tracking.

The broad benchmark remains **PARTIAL** because production-grade completion also requires route-by-route authorization proof, full RLS/account settings, durable worker fencing, provider-aware erasure, human reviewer operations, traffic-based SLO tuning, provider-account verification, and recovery drills. These are not silently treated as DONE.

## Compare board

| Domain | Current verified state | Benchmark/reference | Status |
|---|---|---|---|
| Application security / OWASP | Security headers, origin/body checks, adaptive limits, signed webhooks, trusted Supabase media egress, API inventory, and secret-safe provider boundaries exist. Full route authorization, every-table RLS proof, upload codec validation, API fuzzing, and provider-account hardening remain unverified. | OWASP ASVS 5.0; OWASP API Security Top 10; File Upload and SSRF Cheat Sheets | **PARTIAL** |
| Video safety / moderation | Adult/sexual/graphic/child-safety high-confidence signals remove content from public access, revoke playback, disable download/comments, create creator warnings, audit actions, decision notices, and medium-confidence review. Human review operations, labeled evaluation, drift/fairness measurement, and legal policy approval remain. | DSA Articles 16–17/20/24 as conditional benchmark; Santa Clara Principles; NIST AI RMF | **PARTIAL** |
| Account abuse / bot defense | Upstash route buckets, bearer/IP dimensions, auth/upload/social/search/report/webhook/provider/admin classes, Retry-After responses, and telemetry exist. Traffic-tuned thresholds, device/reputation policy, auth-provider settings, and WAF/bot challenge controls remain unverified. | OWASP API4 and Authentication; RFC 6585; Cloudflare layered rate limiting | **PARTIAL** |
| Media lifecycle / webhooks | Mux asset flow, private-before-processing, raw-body HMAC, timestamp tolerance, duplicate suppression, ordering/stale-event handling, Deepgram/Hive handoff, and safety enforcement exist. Durable inbox/worker acknowledgement, reconciliation, and provider replay E2E remain. | Mux webhook guidance; Redis Streams/consumer groups; CloudEvents identity | **PARTIAL** |
| Queues / retries / self-healing | Dedupe, watchdog, retry classification, provider telemetry and circuit recording exist. Durable worker fencing, effect-level idempotency, DLQ/redrive, Redis Streams PEL recovery, and chaos drills remain. | AWS visibility timeout/DLQ; Redis XREADGROUP/XAUTOCLAIM; Stripe idempotency | **PARTIAL** |
| Privacy / retention / appeals | Soft-remove is reversible; appeals foundation, creator warning visibility, and erasure-request ledger exist. Provider-aware deletion execution, retention schedule, legal holds, DSAR workflow, DPA/transfer review, and human appeal SLAs remain. | GDPR principles; ICO retention/erasure; NIST Privacy Framework; conditional DSA benchmark | **PARTIAL** |
| Observability / SRE | Provider operations, health/circuit state, Sentry, watchdog, correlation-aware operations, SLO draft, incident runbook, and audit records exist. Numeric SLO ownership, burn-rate alert activation, paging, and postmortem operations remain. | Google SRE SLO/alerting; OpenTelemetry; NIST SP 800-61 Rev. 3 | **PARTIAL** |
| Vercel / Supabase architecture | Production Vercel and Supabase migrations verified; service-role isolation, tables, triggers, and secure routes exist. Vercel WAF/protection/cache settings, Supabase Security Advisor, MFA/network restrictions, backups/PITR, RPO/RTO and restore drill remain unverified. | Official Vercel production checklist/rolling releases; Supabase production, pooling, backup guidance | **PARTIAL** |
| Performance / scale / cost | Async provider calls, bounded timeouts, Upstash limits, dedupe, metrics and watchdog exist. Route cache contracts, Redis TTL/eviction, DB pool/query evidence, provider admission budgets, Mux quality/storage policy, and Sentry sampling remain. | Vercel CDN cache; Supabase connection management; Upstash eviction; Mux cost guidance; Sentry sample rates | **PARTIAL** |
| Admin / transparency / trust UX | Secure admin enforcement, reason codes, warnings, decision notices, audit-chain foundation, appeals foundation, API inventory and incident runbook exist. Full statement-of-reasons UX, human reviewer QA, chained-digest verification, WCAG appeal UX, and public transparency publication remain. | Conditional DSA transparency/complaints; OWASP Logging; WCAG 2.2; NIST incident response | **PARTIAL** |

## Newly completed implementation items

| System | Status | Evidence |
|---|---|---|
| Versioned moderation policy registry | **DONE** | `server/policyRegistry.ts`, unit tests, and provider analysis reference `hktube-policy-2026-10-05`. |
| Trusted provider media egress / SSRF guard | **DONE** | Mux/Deepgram/Hive inputs require HTTPS on the configured Supabase storage host; credentials, ports, and arbitrary hosts are rejected. |
| Machine-readable API inventory | **DONE** | `docs/api-inventory.md` records route surface, auth boundary, sensitive behavior, and release gates. |
| SLO and incident runbook | **DONE** as operational draft | `docs/slo-and-incident-runbook.md` defines SLIs, severity, containment, recovery, verification, audit, and PIR steps; numeric targets remain unactivated. |
| Deterministic high-confidence enforcement | **DONE** | Supabase RPC soft-removes, revokes playback, disables download/comments, writes creator warning and moderation audit action. Synthetic adult, graphic, child-safety, medium-review and admin-command fixtures passed. |
| Secure admin enforcement command | **DONE** | `/api/admin/moderation/enforce` requires bearer authentication and `profiles.role=admin`; commands are allowlisted. |
| Durable moderation decision notices | **DONE** | `moderation_decision_notices` production table and trigger from automated moderation actions; creator-readable through RLS. |
| Audit-chain foundation | **DONE** as foundation | `moderation_audit_chain` is service-role-only and stores event hash, actor, target, policy version and action payload. Full chained-digest verification remains. |
| Privacy erasure ledger | **DONE** as ledger | `privacy_erasure_requests` stores requested/processing/completed/failed/legal-hold states and provider status; physical deletion is not activated without policy approval. |

## Exact remaining blockers

1. **Human policy and operations:** final thresholds, exceptions, appeal SLAs, reviewer staffing/independence, minors handling, retention/legal holds, and fail-open/closed policy require accountable owners.
2. **Provider/account settings:** Vercel WAF/deployment protection/regions, Supabase RLS/Security Advisor/MFA/network restrictions/backups, and Mux/Deepgram/Hive/Upstash quotas/webhook settings/retention require account-level verification.
3. **Durable worker substrate:** Redis Streams consumer groups/PEL/XAUTOCLAIM and worker runtime availability require verification of the existing Upstash plan and persistent worker runtime.
4. **Moderation quality proof:** an approved, safely handled labeled dataset and qualified reviewers are required before claiming precision, recall, fairness, drift, or appeal-performance results.
5. **Production SLO tuning:** real traffic, cost, queue age, alert ownership, and on-call staffing are required before activating numeric paging thresholds.
6. **Full E2E provider proof:** a safe test upload plus valid signed Mux event is required to prove Upload → Mux → Deepgram → Hive → Safety → Audit → Review/Publish. Configuration flags alone are not proof.
7. **Physical erasure execution:** provider-aware deletion and legal-hold behavior require retention policy, provider capabilities, and privacy/legal approval; only the ledger is currently active.

## Intentionally excluded

- **MySQL / DATABASE_URL:** **SKIPPED** by project instruction.
- **Google Translation / ElevenLabs / separate paid copyright provider:** **SKIPPED** by project instruction.
- **Clips UI rewrite:** **SKIPPED**; shared backend controls are used without redesigning Clips.
- **Physical hard-delete on automated moderation:** **SKIPPED**; reversible soft removal is safer until retention and appeal policy approve irreversible deletion.

## Benchmark sources

- [OWASP ASVS](https://owasp.org/projects/asvs)
- [OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Mux webhook signatures](https://www.mux.com/docs/core/verify-webhook-signatures)
- [Mux webhook delivery](https://www.mux.com/docs/core/listen-for-webhooks)
- [Redis Streams](https://redis.io/docs/latest/develop/data-types/streams/)
- [AWS queue visibility/DLQ](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html)
- [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests)
- [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585)
- [Google SRE SLOs](https://sre.google/workbook/implementing-slos/)
- [OpenTelemetry propagation](https://opentelemetry.io/docs/concepts/context-propagation/)
- [EU Digital Services Act](https://eur-lex.europa.eu/eli/reg/2022/2065/oj/eng)
- [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework)
- [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Vercel production checklist](https://vercel.com/docs/production-checklist)
- [Supabase production](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase backups](https://supabase.com/docs/guides/platform/backups)
- [Vercel CDN caching](https://vercel.com/docs/caching/cdn-cache)
- [Upstash eviction](https://upstash.com/docs/redis/features/eviction)
- [Mux cost optimization](https://www.mux.com/docs/pricing/optimizing-video-costs)

## No-fake-completion rule

This board is intentionally not a “100%” claim. **DONE** means actual implementation and verification. **PARTIAL** means code/foundation exists but proof or operations are incomplete. **BLOCKED** means an external dependency or human decision is required. **SKIPPED** means intentionally excluded by project decision.
