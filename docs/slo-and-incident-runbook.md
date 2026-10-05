# HkTube SLO and Incident Runbook

**Version:** 2026-10-05  
**Status:** Operational draft; alert thresholds require production traffic and owner approval.

## Initial SLI/SLO candidates

| Journey | SLI | Initial status |
|---|---|---|
| API availability | Good 2xx/expected 4xx responses divided by total requests, excluding health probes | Instrumented target pending traffic baseline |
| Upload freshness | Upload-to-media-ready age percentile | Instrumentation target |
| Moderation freshness | Media-ready-to-safety-decision age percentile | Instrumentation target |
| Webhook processing | Durable accepted receipts divided by valid signed events | Instrumented |
| Queue freshness | Age of oldest queued/leased item and quarantine depth | Watchdog instrumented |
| Provider reliability | Success/error/timeout/rate-limit counts and latency by provider operation | Provider telemetry instrumented |
| Appeals | Age and state of pending appeals; reversal outcome | Workflow target |

No numeric SLO is declared DONE until traffic volume, owner, exclusion rules, and data quality are reviewed.

## Severity model

- **SEV-1:** Public safety, authentication, data integrity, or broad availability risk. Pause dangerous automation, preserve evidence, assign incident commander, and communicate status.
- **SEV-2:** Material degradation of a critical workflow or provider with bounded workaround. Reduce admission/concurrency and protect queues.
- **SEV-3:** Localized defect, backlog, or non-critical integration issue. Track, mitigate, and schedule a fix.

## Response sequence

1. **Detect:** capture correlation ID, deployment SHA, route/job/event ID, provider, first-seen time, and affected user/content scope.
2. **Contain:** use the relevant kill switch/circuit breaker, keep content private when safety state is uncertain, and stop bulk actions before expanding blast radius.
3. **Diagnose:** compare provider health, queue age, webhook receipts, database state, and recent deployment; never log or copy secrets.
4. **Recover:** retry only transient infrastructure/provider failures; reclaim stale leases; quarantine poison jobs; ignore stale events; reconcile state before publishing.
5. **Verify:** run a bounded synthetic fixture or safe health probe; confirm no stale worker or old event can overwrite newer state.
6. **Record:** write an append-oriented audit entry and a short timeline with owner, impact, root/contributing factors, and corrective actions.

## Safety rules

- High-confidence safety violations use reversible soft removal; physical deletion requires a separately approved retention policy.
- Low/medium confidence remains private/review; the system never invents certainty.
- Provider outage must not be reported as success.
- Replays require an idempotency key and an authorized replay reason.
- No raw transcript, sensitive media, token, cookie, webhook signature, or secret belongs in logs/Sentry.

## Post-incident review

Record: impact, affected scope, timeline, detection gap, containment, recovery, contributing factors, what worked, what failed, action owner/date, test evidence, and the deployment/migration that closes the issue. Review alert noise and update the API inventory, policy registry, and runbook when controls change.
