# HkTube Autonomous Comparison Board

**Prepared:** 2026-10-05  
**Scope:** Existing HkTube baseline versus authoritative production benchmarks and verified implementation status.  
**Status vocabulary:** Only **DONE**, **PARTIAL**, **BLOCKED**, or **SKIPPED**.  
**Completion rule:** No domain is claimed 100% complete without route-level, production, operational, and human-policy evidence.

## Executive summary

HkTube now has a real autonomous safety and reliability foundation: deterministic moderation, high-confidence soft removal, creator warnings, provider telemetry/circuit data, queue watchdog, appeals foundation, signed/idempotent webhooks, adaptive rate limits, policy versioning, trusted media egress, API inventory, and an SLO/incident runbook.

The benchmark comparison still marks every broad domain **PARTIAL** because production-grade completion also needs route-by-route authorization proof, full RLS/account settings, durable worker fencing, retention/erasure operations, human reviewer staffing, traffic-based SLO tuning, provider-account verification, and recovery drills. These are not silently treated as DONE.

## Compare board

| Domain | HkTube current state | Benchmark/reference | Status |
|---|---|---|---|
| Application security / OWASP | Security headers, origin checks, body limits, adaptive limits, signed webhooks, trusted Supabase media egress, and API inventory are implemented. Full route authorization, every-table RLS proof, upload codec validation, API fuzzing, and provider-account hardening remain unverified. | OWASP ASVS 5.0; OWASP API Security Top 10; File Upload and SSRF Cheat Sheets | **PARTIAL** |
| Video safety / moderation | Deterministic policy engine, adult/sexual/graphic/child-safety high-confidence removal, private quarantine, playback revoke, creator warning, audit action, medium-confidence review, policy registry and versioned decisions are implemented. Human review operations, labeled evaluation, drift/fairness measurement, and legal policy approval remain. | DSA Articles 16–17/20/24 as conditional benchmark; Santa Clara Principles; NIST AI RMF | **PARTIAL** |
| Account abuse / bot defense | Upstash route buckets, IP plus hashed bearer identity, auth/upload/social/search/report/webhook/provider/admin classes, Retry-After responses, and provider telemetry are implemented. Traffic-tuned thresholds, device/reputation policy, auth-provider settings, and WAF/bot challenge controls remain unverified. | OWASP API4 and Authentication; RFC 6585; Cloudflare layered rate limiting | **PARTIAL** |
| Media lifecycle / webhooks | Mux asset flow, private-before-processing, raw-body HMAC, timestamp tolerance, duplicate suppression, ordered webhook records, stale-event ignore, Deepgram/Hive handoff, and safety enforcement are implemented. Durable inbox/worker acknowledgement, reconciliation, and provider replay E2E remain. | Mux webhook guidance; Redis Streams/consumer groups; CloudEvents identity | **PARTIAL** |
| Queues / retries / self-healing | Existing dedupe, watchdog, retry classification, provider telemetry and circuit recording are deployed. Durable worker fencing, effect-level idempotency, DLQ/redrive, Redis Streams PEL recovery, and chaos drills remain. | AWS visibility timeout/DLQ; Redis XREADGROUP/XAUTOCLAIM; Stripe idempotency | **PARTIAL** |
| Privacy / retention / appeals | Soft-remove is reversible; appeals foundation and creator warning visibility exist. Provider-aware deletion ledger, retention schedule, legal holds, DSAR workflow, DPA/transfer review, and human appeal SLAs remain. | GDPR principles; ICO retention/erasure; NIST Privacy Framework; conditional DSA benchmark | **PARTIAL** |
| Observability / SRE | Provider operations, health state, circuit state, metrics, Sentry, watchdog, correlation-aware operations, SLO draft and incident runbook exist. Numeric SLO ownership, burn-rate alert activation, paging, and postmortem operations remain. | Google SRE SLO/alerting; OpenTelemetry context propagation; NIST SP 800-61 Rev. 3 | **PARTIAL** |
| Vercel / Supabase architecture | Production Vercel deployment and Supabase migrations verified; service-role isolation, RLS migrations, provider telemetry tables, and secure server routes exist. Vercel protection/WAF/cache settings, Supabase Security Advisor, MFA/network restrictions, backups/PITR, RPO/RTO and restore drill remain unverified. | Official Vercel production checklist/rolling releases; Supabase production, pooling, backup guidance | **PARTIAL** |
| Performance / scale / cost | Async provider calls, bounded timeouts, Upstash limits, dedupe, metrics and watchdog exist. Route cache contracts, Redis TTL/eviction, DB pool/query evidence, provider admission budgets, Mux quality/storage policy, and Sentry sampling remain. | Vercel CDN cache; Supabase connection management; Upstash eviction; Mux cost guidance; Sentry sample rates | **PARTIAL** |
| Admin / transparency / trust UX | Secure admin enforcement endpoint, reason codes, creator warnings, appeals foundation, audit actions, API inventory and incident runbook exist. Full statement-of-reasons UI, human reviewer QA, tamper-evident audit chain, WCAG appeal UX, and public transparency publication remain. | Conditional DSA transparency/complaints; OWASP Logging; WCAG 2.2; NIST incident response | **PARTIAL** |

## Newly implemented in this research/upgrade pass

| System | Status | Verified evidence |
|---|---|---|
| Versioned moderation policy registry | **DONE** | `server/policyRegistry.ts`, policy unit tests, and provider analysis now reference `hktube-policy-2026-10-05`. |
| Trusted provider media egress | **DONE** | Mux/Deepgram/Hive input URLs must be HTTPS on the configured Supabase storage host; credentials, ports, and arbitrary hosts are rejected. |
| Machine-readable API inventory | **DONE** | `docs/api-inventory.md` records route surface, auth boundary, sensitive behavior, and release gates. |
| SLO and incident runbook | **DONE** as operational draft | `docs/slo-and-incident-runbook.md` defines SLIs, severity, containment, recovery, verification, audit, and PIR steps. Numeric targets remain intentionally unactivated. |
| Deterministic high-confidence enforcement | **DONE** | Supabase RPC removes from public access, soft-deletes, revokes playback, disables download/comments, writes creator warning, and writes moderation audit action. Synthetic production fixtures verified adult, graphic, child-safety, medium-review, and admin-command paths. |
| Secure admin enforcement command | **DONE** | `/api/admin/moderation/enforce` requires bearer authentication and `profiles.role=admin`; commands are allowlisted. |

## Exact remaining blockers

1. **Human policy and operations:** final thresholds, exceptions, appeal SLAs, reviewer staffing/independence, minors handling, retention/legal holds, and fail-open/closed policy require accountable human owners.
2. **Provider/account settings:** Vercel WAF/deployment protection/regions, Supabase RLS/Security Advisor/MFA/network restrictions/backups, and Mux/Deepgram/Hive/Upstash quotas, webhook settings, and retention require account-level verification.
3. **Durable worker substrate:** Redis Streams consumer groups/PEL/XAUTOCLAIM and worker runtime availability require verification of the existing Upstash plan and a persistent worker runtime. No unverified migration is claimed.
4. **Moderation quality proof:** an approved, safely handled labeled dataset and qualified reviewers are required before claiming precision, recall, fairness, drift, or appeal-performance results.
5. **Production SLO tuning:** real traffic, cost, queue age, alert ownership, and on-call staffing are required before activating numeric paging thresholds.
6. **Full E2E provider proof:** a safe test upload plus valid signed Mux event is required to prove the complete Upload → Mux → Deepgram → Hive → Safety → Audit → Review/Publish chain. Configuration flags alone are not proof of successful provider media processing.

## Intentionally excluded

- **MySQL / DATABASE_URL:** **SKIPPED** by project instruction; no new dependency created.
- **Google Translation / ElevenLabs / separate paid copyright provider:** **SKIPPED** by project instruction.
- **Clips UI rewrite:** **SKIPPED**; shared backend safety behavior is used without redesigning Clips styling/UI.
- **Physical hard-delete on automated moderation:** **SKIPPED**; reversible soft removal is safer until retention, appeal, and legal policy approve irreversible deletion.

## Sources used for the benchmark

- [OWASP ASVS](https://owasp.org/projects/asvs)
- [OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Mux webhook signature verification](https://www.mux.com/docs/core/verify-webhook-signatures)
- [Mux webhook delivery](https://www.mux.com/docs/core/listen-for-webhooks)
- [Redis Streams](https://redis.io/docs/latest/develop/data-types/streams/)
- [AWS SQS visibility timeout and DLQ guidance](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html)
- [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585)
- [Google SRE SLO workbook](https://sre.google/workbook/implementing-slos/)
- [OpenTelemetry context propagation](https://opentelemetry.io/docs/concepts/context-propagation/)
- [EU Digital Services Act](https://eur-lex.europa.eu/eli/reg/2022/2065/oj/eng)
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
- [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Vercel production checklist](https://vercel.com/docs/production-checklist)
- [Supabase going into production](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase backups](https://supabase.com/docs/guides/platform/backups)
- [Vercel CDN caching](https://vercel.com/docs/caching/cdn-cache)
- [Upstash eviction](https://upstash.com/docs/redis/features/eviction)
- [Mux cost optimization](https://www.mux.com/docs/pricing/optimizing-video-costs)

## No-fake-completion rule

This board is intentionally not a “100%” claim. **DONE** means actual implementation and verification. **PARTIAL** means code or a foundation exists but proof/operations are incomplete. **BLOCKED** means an external dependency or human decision is required. **SKIPPED** means intentionally excluded by project decision.
