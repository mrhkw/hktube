-- HkTube 31-category AI runtime foundation. Additive only: no business-table mutation.
-- Apply through the authorized Supabase migration workflow before enabling runtime routes.

create table if not exists public.ai_runtime_teams (
  team_id text primary key,
  category integer not null unique check (category between 1 and 31),
  name text not null,
  purpose text not null,
  lifecycle text not null default 'DRAFT' check (lifecycle in ('DRAFT','TESTING','APPROVED','ACTIVE','PAUSED','DEPRECATED','DISABLED')),
  enabled boolean not null default false,
  runtime_status text not null default 'BLOCKED' check (runtime_status in ('READY','QUEUED','RUNNING','WAITING','WAITING_FOR_APPROVAL','RETRYING','SUCCESS','FAILED','BLOCKED','DISABLED')),
  required_integrations text[] not null default '{}',
  safe_actions text[] not null default '{}',
  risk text not null default 'MEDIUM' check (risk in ('LOW','MEDIUM','HIGH','CRITICAL')),
  requires_approval boolean not null default false,
  block_reason text not null default 'RUNTIME_NOT_INITIALIZED',
  last_execution_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_runtime_agents (
  agent_id text primary key,
  team_id text not null references public.ai_runtime_teams(team_id) on delete restrict,
  name text not null,
  purpose text not null,
  lifecycle text not null default 'DRAFT' check (lifecycle in ('DRAFT','TESTING','APPROVED','ACTIVE','PAUSED','DEPRECATED','DISABLED')),
  enabled boolean not null default false,
  permissions jsonb not null default '[]'::jsonb,
  triggers jsonb not null default '[]'::jsonb,
  quotas jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_runtime_events (
  event_id uuid primary key default gen_random_uuid(),
  source text not null,
  event_type text not null,
  idempotency_key text not null,
  payload_reference text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'NEW' check (status in ('NEW','QUEUED','PROCESSING','SUCCESS','FAILED','BLOCKED','DUPLICATE')),
  retry_count integer not null default 0 check (retry_count >= 0),
  audit_reference uuid,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (source, event_type, idempotency_key)
);

create table if not exists public.ai_runtime_tasks (
  task_id uuid primary key default gen_random_uuid(),
  team_id text not null references public.ai_runtime_teams(team_id) on delete restrict,
  agent_id text references public.ai_runtime_agents(agent_id) on delete restrict,
  action text not null,
  actor_id text not null,
  idempotency_key text not null,
  status text not null default 'NEW' check (status in ('NEW','QUEUED','PROCESSING','WAITING','WAITING_FOR_APPROVAL','APPROVED','RETRYING','SUCCESS','FAILED','BLOCKED','CANCELLED','EXPIRED')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  verified boolean not null default false,
  error_code text,
  error_message text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 5),
  priority smallint not null default 0 check (priority between -10 and 10),
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  lock_token uuid,
  approval_id uuid,
  audit_id uuid,
  request_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (team_id, actor_id, idempotency_key),
  check (status <> 'SUCCESS' or verified = true)
);

create index if not exists ai_runtime_tasks_queue_idx on public.ai_runtime_tasks(status, available_at, priority desc, created_at);
create index if not exists ai_runtime_tasks_team_created_idx on public.ai_runtime_tasks(team_id, created_at desc);

create table if not exists public.ai_runtime_approvals (
  approval_id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.ai_runtime_tasks(task_id) on delete restrict,
  requested_by text not null,
  required_role text not null,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','EXPIRED','CANCELLED')),
  approved_by text,
  reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  decided_at timestamptz
);

create table if not exists public.ai_runtime_audit (
  audit_id uuid primary key default gen_random_uuid(),
  actor_type text not null,
  actor_id text,
  team_id text,
  agent_id text,
  task_id uuid,
  action text not null,
  resource text,
  before_state jsonb,
  after_state jsonb,
  result text not null check (result in ('ALLOW','DENY','WAITING_FOR_APPROVAL','BLOCKED','SUCCESS','FAILED','RETRYING')),
  error_code text,
  error_message text,
  request_id text,
  approval_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists ai_runtime_audit_created_idx on public.ai_runtime_audit(created_at desc);
create index if not exists ai_runtime_audit_task_idx on public.ai_runtime_audit(task_id, created_at desc);

create table if not exists public.ai_runtime_integrations (
  integration_id text primary key,
  display_name text not null,
  state text not null default 'NOT_CONFIGURED' check (state in ('NOT_CONFIGURED','CONFIGURED','TESTING','CONNECTED','TOKEN_EXPIRED','PERMISSION_DENIED','RATE_LIMITED','FAILED','DISABLED')),
  checked_at timestamptz,
  last_error_code text,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_runtime_notifications (
  notification_id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  severity text not null check (severity in ('INFO','WARNING','HIGH','CRITICAL')),
  title text not null,
  body text not null,
  team_id text,
  task_id uuid,
  status text not null default 'PENDING' check (status in ('PENDING','DELIVERED','FAILED','SUPPRESSED')),
  channel text not null default 'ADMIN_DASHBOARD',
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create table if not exists public.ai_runtime_memories (
  memory_id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('USER','TEAM','AGENT','TASK','PROJECT','CONVERSATION','PREFERENCE','SYSTEM')),
  owner_id text not null,
  memory_key text not null,
  value jsonb not null,
  source text not null,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  privacy_class text not null check (privacy_class in ('PUBLIC','INTERNAL','PRIVATE','SENSITIVE')),
  expires_at timestamptz,
  created_by text not null,
  audit_id uuid references public.ai_runtime_audit(audit_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_type, owner_id, memory_key)
);

create table if not exists public.ai_runtime_health (
  health_id uuid primary key default gen_random_uuid(),
  component text not null,
  state text not null check (state in ('HEALTHY','DEGRADED','WARNING','CRITICAL','BLOCKED')),
  checked_at timestamptz not null default now(),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  details jsonb not null default '{}'::jsonb,
  error_code text
);
create index if not exists ai_runtime_health_component_idx on public.ai_runtime_health(component, checked_at desc);

-- Seed the canonical 31 teams as DRAFT/BLOCKED. A definition is not an active worker.
insert into public.ai_runtime_teams (team_id, category, name, purpose, required_integrations, safe_actions, risk, requires_approval)
values
  ('all-inbox',1,'All-Inbox Team','Route authorized inbound conversations and support events.',array['support-inbox','gmail-api','meta-messaging'],array['classify-internal-support'],'HIGH',true),
  ('bug-hunter',2,'Bug Hunter + Fix + Test','Investigate errors and produce tested, reviewable code changes.',array['github-app','isolated-code-runner'],array['analyze-error','propose-fix'],'HIGH',true),
  ('backup-database',3,'Backup + Database','Create and verify recoverable database backups.',array['database-backup','private-object-storage','durable-worker'],array['inspect-backup-status'],'CRITICAL',true),
  ('sales-orders',4,'Sales + Order + Invoice','Process verified orders and maintain invoice/order state.',array['orders-database','signed-commerce-webhook'],array['validate-order-event'],'CRITICAL',true),
  ('security-shield',5,'Security Shield','Review security signals and issue audited alerts.',array['security-event-store','alert-delivery'],array['review-security-events'],'HIGH',false),
  ('content-moderation',6,'Content Moderation / Adult Auto Delete','Classify uploads and route uncertain cases to human review.',array['moderation-provider','moderation-policy','review-queue'],array['queue-human-review'],'CRITICAL',true),
  ('algorithm-feed',7,'Algorithm & Feed','Rank safe, privacy-respecting HkTube recommendations using verified signals.',array['feed-signals','safety-state'],array['inspect-ranking-inputs'],'HIGH',true),
  ('spam-fake',8,'Spam & Fake','Detect duplicate/spam activity and escalate uncertain cases.',array['comment-store','spam-policy','review-queue'],array['queue-spam-review'],'HIGH',true),
  ('customer-help',9,'Customer Feedback & Help','Track support requests through triage, response, verification and closure.',array['support-inbox','support-task-store'],array['triage-support-request'],'MEDIUM',false),
  ('notification',10,'Notification Team','Deduplicate and route persisted runtime notifications.',array['runtime-database'],array['create-in-app-notification'],'LOW',false),
  ('speed-server',11,'Speed & Server Team','Check API health and measure verified request latency.',array['health-endpoint'],array['check-api-health'],'LOW',false),
  ('page-builder',12,'Page Builder Team','Create controlled page changes in an isolated branch for review.',array['github-app','isolated-code-runner'],array['propose-page-plan'],'HIGH',true),
  ('feature-adder',13,'Feature Adder Team','Turn approved feature requests into tested, reviewable changes.',array['github-app','isolated-code-runner'],array['analyze-feature-request'],'HIGH',true),
  ('payment-guard',14,'Payment Guard Team','Process only signature-verified payment-provider events.',array['payment-provider','signed-payment-webhook'],array['inspect-payment-event'],'CRITICAL',true),
  ('product-manager',15,'Product Manager Team','Prepare validated product-change previews and audit proposals.',array['product-catalog','approval-engine'],array['propose-product-change'],'HIGH',true),
  ('content-writer',16,'Content Writer Team','Draft and validate AI-assisted content; never publish without approval.',array['ai-provider','runtime-database'],array['draft-content','summarize-content'],'LOW',false),
  ('image-thumbnail',17,'Image & Thumbnail Team','Generate or optimize media assets and verify authorized storage results.',array['image-provider','private-object-storage','media-validation'],array['inspect-thumbnail-request'],'MEDIUM',false),
  ('video-processor',18,'Video Processor Team','Validate, transcode and verify video outputs in a durable worker.',array['media-worker','private-object-storage','video-metadata'],array['validate-video-metadata'],'HIGH',true),
  ('seo',19,'SEO Team','Audit page metadata while preserving existing route and canonical contracts.',array['site-crawler','github-app','isolated-code-runner'],array['audit-seo-metadata'],'MEDIUM',true),
  ('social-media',20,'Social Media Team','Prepare approved platform-specific content and publish only via official APIs.',array['social-platform-api','publishing-approval'],array['prepare-social-draft'],'HIGH',true),
  ('ads',21,'Ads Team','Analyze verified campaign data and prepare controlled proposals.',array['ads-platform-api','campaign-approval'],array['propose-campaign'],'CRITICAL',true),
  ('lead',22,'Lead Team','Capture consented inquiries with minimal, access-controlled personal data.',array['consented-lead-store'],array['validate-lead-event'],'HIGH',false),
  ('analytics',23,'Analytics Team','Aggregate real HkTube metrics and label unavailable sources explicitly.',array['analytics-source','runtime-database'],array['inspect-analytics-source'],'LOW',false),
  ('cron-boss',24,'Cron Boss','Schedule and dispatch bounded tasks with leases, retries and audit.',array['durable-worker','scheduler-secret','runtime-database'],array['inspect-scheduler-status'],'HIGH',false),
  ('api-connector',25,'API Connector Team','Register provider metadata and verify connections without exposing secrets.',array['provider-credentials','runtime-database'],array['inspect-provider-config'],'HIGH',true),
  ('memory',26,'Memory Team','Store only privacy-scoped, approved, expiring operational memories.',array['runtime-database','memory-policy'],array['inspect-memory-policy'],'HIGH',false),
  ('learning',27,'Learning Team','Propose low-risk workflow preferences without self-granting permissions.',array['runtime-database','memory-policy'],array['propose-workflow-preference'],'MEDIUM',false),
  ('translator-voice',28,'Translator & Voice Team','Translate text; voice operations require a verified audio provider.',array['ai-provider'],array['translate-text'],'LOW',false),
  ('github-deployer',29,'GitHub Deployer Team','Run authorized, reviewable GitHub/Vercel workflows after release approval.',array['github-app','vercel-api','release-approval'],array['inspect-deployment-status'],'CRITICAL',true),
  ('boss-ceo',30,'Boss CEO','Decompose requests into policy-checked team tasks and report partial outcomes honestly.',array['runtime-database','task-orchestrator'],array['plan-task-breakdown'],'HIGH',false),
  ('ultra-pro-max-ceo',31,'Ultra Pro Max CEO','Propose system-wide improvements through the same permission and approval engines.',array['runtime-database','task-orchestrator','approval-engine'],array['propose-system-improvement'],'CRITICAL',true)
on conflict (team_id) do nothing;

insert into public.ai_runtime_agents (agent_id, team_id, name, purpose, permissions)
select team_id || '-primary', team_id, name || ' Primary Agent', purpose, to_jsonb(safe_actions)
from public.ai_runtime_teams
on conflict (agent_id) do nothing;

-- No browser role may read/write runtime data directly. Backend routes use service_role only.
do $$
declare t text;
begin
  foreach t in array array[
    'ai_runtime_teams','ai_runtime_agents','ai_runtime_events','ai_runtime_tasks',
    'ai_runtime_approvals','ai_runtime_audit','ai_runtime_integrations',
    'ai_runtime_notifications','ai_runtime_memories','ai_runtime_health'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

create or replace function public.enqueue_ai_runtime_task(
  p_team_id text,
  p_action text,
  p_input jsonb,
  p_actor_id text,
  p_idempotency_key text,
  p_request_id text default null
) returns public.ai_runtime_tasks
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_task public.ai_runtime_tasks;
begin
  if length(coalesce(p_action,'')) not between 1 and 80 then raise exception 'invalid_action'; end if;
  if length(coalesce(p_actor_id,'')) not between 1 and 180 then raise exception 'invalid_actor'; end if;
  if length(coalesce(p_idempotency_key,'')) not between 8 and 160 then raise exception 'invalid_idempotency_key'; end if;
  if pg_column_size(coalesce(p_input, '{}'::jsonb)) > 32768 then raise exception 'task_input_too_large'; end if;
  if not exists (select 1 from public.ai_runtime_teams t where t.team_id=p_team_id and t.enabled=true and t.lifecycle='ACTIVE' and p_action=any(t.safe_actions)) then raise exception 'team_not_active_or_action_not_allowlisted'; end if;
  if exists (
    select 1 from public.ai_runtime_teams t
    cross join lateral unnest(t.required_integrations) required(integration_id)
    left join public.ai_runtime_integrations i on i.integration_id=required.integration_id
    where t.team_id=p_team_id and (
      coalesce(i.state,'NOT_CONFIGURED') <> 'CONNECTED'
      or (required.integration_id='ai-provider' and (i.checked_at is null or i.checked_at <= now()-interval '15 minutes'))
    )
  ) then raise exception 'required_integration_not_verified'; end if;

  insert into public.ai_runtime_tasks(team_id, agent_id, action, actor_id, idempotency_key, status, input, request_id)
  values(p_team_id, p_team_id || '-primary', p_action, p_actor_id, p_idempotency_key, 'QUEUED', coalesce(p_input,'{}'::jsonb), p_request_id)
  on conflict (team_id, actor_id, idempotency_key) do nothing;

  select * into v_task from public.ai_runtime_tasks
  where team_id=p_team_id and actor_id=p_actor_id and idempotency_key=p_idempotency_key;
  return v_task;
end $$;

create or replace function public.claim_ai_runtime_tasks(
  p_worker_id text,
  p_limit integer default 1,
  p_lease_seconds integer default 45
) returns setof public.ai_runtime_tasks
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if length(coalesce(p_worker_id,'')) not between 1 and 120 then raise exception 'invalid_worker_id'; end if;
  if p_limit < 1 or p_limit > 5 or p_lease_seconds < 10 or p_lease_seconds > 300 then raise exception 'invalid_worker_limits'; end if;

  with expired as (
    update public.ai_runtime_tasks
    set status = case when attempt_count >= max_attempts then 'FAILED' else 'RETRYING' end,
        error_code = 'LEASE_EXPIRED', error_message = 'Worker lease expired before verified completion.',
        lease_until = null, lock_token = null, updated_at = now(),
        completed_at = case when attempt_count >= max_attempts then now() else null end
    where status='PROCESSING' and lease_until < now()
    returning *
  ), audit_rows as (
    insert into public.ai_runtime_audit(actor_type, actor_id, team_id, agent_id, task_id, action, resource, result, error_code, error_message, request_id, before_state, after_state)
    select 'worker', expired.actor_id, expired.team_id, expired.agent_id, expired.task_id, 'task.lease.expired', 'ai_runtime_tasks',
      case when expired.status='FAILED' then 'FAILED' else 'RETRYING' end, 'LEASE_EXPIRED',
      'Worker lease expired before verified completion.', expired.request_id,
      jsonb_build_object('status','PROCESSING'), jsonb_build_object('status',expired.status)
    from expired returning task_id
  )
  insert into public.ai_runtime_notifications(dedupe_key, severity, title, body, team_id, task_id)
  select expired.task_id::text || ':LEASE_EXPIRED:' || expired.status,
    'WARNING', case when expired.status='FAILED' then 'Agent task lease expired and failed' else 'Agent task lease expired; retry scheduled' end,
    'Worker lease expired before verified completion.', expired.team_id, expired.task_id
  from expired on conflict (dedupe_key) do nothing;

  with blocked as (
    update public.ai_runtime_tasks task
    set status='BLOCKED',
        error_code=case when not exists (select 1 from public.ai_runtime_teams t where t.team_id=task.team_id and t.enabled=true and t.lifecycle='ACTIVE') then 'TEAM_NOT_ACTIVE' else 'INTEGRATION_NOT_VERIFIED' end,
        error_message=case when not exists (select 1 from public.ai_runtime_teams t where t.team_id=task.team_id and t.enabled=true and t.lifecycle='ACTIVE') then 'Team was not active when the worker attempted to claim this task.' else 'A required integration is no longer verified.' end,
        lease_until=null, lock_token=null, completed_at=now(), updated_at=now()
    where task.status in ('QUEUED','RETRYING') and (
      not exists (select 1 from public.ai_runtime_teams t where t.team_id=task.team_id and t.enabled=true and t.lifecycle='ACTIVE')
      or exists (
        select 1 from public.ai_runtime_teams t
        cross join lateral unnest(t.required_integrations) required(integration_id)
        left join public.ai_runtime_integrations i on i.integration_id=required.integration_id
        where t.team_id=task.team_id and (
          coalesce(i.state,'NOT_CONFIGURED') <> 'CONNECTED'
          or (required.integration_id='ai-provider' and (i.checked_at is null or i.checked_at <= now()-interval '15 minutes'))
        )
      )
    )
    returning *
  ), audit_rows as (
    insert into public.ai_runtime_audit(actor_type, actor_id, team_id, agent_id, task_id, action, resource, result, error_code, error_message, request_id, before_state, after_state)
    select 'worker', blocked.actor_id, blocked.team_id, blocked.agent_id, blocked.task_id, 'task.claim.blocked', 'ai_runtime_tasks', 'BLOCKED',
      blocked.error_code, blocked.error_message, blocked.request_id,
      jsonb_build_object('status',blocked.status), jsonb_build_object('status','BLOCKED')
    from blocked returning task_id
  )
  insert into public.ai_runtime_notifications(dedupe_key, severity, title, body, team_id, task_id)
  select blocked.task_id::text || ':CLAIM_BLOCKED:' || blocked.error_code, 'WARNING', 'Agent task blocked before execution',
    left(blocked.error_message,500), blocked.team_id, blocked.task_id
  from blocked on conflict (dedupe_key) do nothing;

  return query
  with picked as (
    select task.task_id from public.ai_runtime_tasks task
    join public.ai_runtime_teams team on team.team_id=task.team_id
    where task.status in ('QUEUED','RETRYING') and task.available_at <= now()
      and (task.lease_until is null or task.lease_until < now())
      and team.enabled=true and team.lifecycle='ACTIVE'
      and not exists (
        select 1 from unnest(team.required_integrations) required(integration_id)
        left join public.ai_runtime_integrations integration on integration.integration_id=required.integration_id
        where coalesce(integration.state,'NOT_CONFIGURED') <> 'CONNECTED'
          or (required.integration_id='ai-provider' and (integration.checked_at is null or integration.checked_at <= now()-interval '15 minutes'))
      )
    order by task.priority desc, task.created_at asc
    for update skip locked
    limit p_limit
  )
  update public.ai_runtime_tasks t
  set status='PROCESSING', attempt_count=t.attempt_count+1,
      lease_until=now() + make_interval(secs => p_lease_seconds),
      lock_token=gen_random_uuid(), started_at=coalesce(t.started_at,now()), updated_at=now()
  from picked where t.task_id=picked.task_id
  returning t.*;
end $$;

create or replace function public.finish_ai_runtime_task(
  p_task_id uuid,
  p_lock_token uuid,
  p_status text,
  p_output jsonb default null,
  p_error_code text default null,
  p_error_message text default null,
  p_verified boolean default false,
  p_retry_at timestamptz default null
) returns public.ai_runtime_tasks
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_task public.ai_runtime_tasks;
begin
  if p_status not in ('SUCCESS','FAILED','BLOCKED','WAITING','WAITING_FOR_APPROVAL','RETRYING') then raise exception 'invalid_finish_status'; end if;
  if p_status='SUCCESS' and coalesce(p_verified,false) is not true then raise exception 'success_requires_verification'; end if;

  select * into v_task from public.ai_runtime_tasks
  where task_id=p_task_id and status='PROCESSING' and lock_token=p_lock_token and lease_until > now()
  for update;
  if not found then raise exception 'task_lease_not_owned'; end if;
  if p_status='RETRYING' and v_task.attempt_count >= v_task.max_attempts then p_status := 'FAILED'; end if;

  update public.ai_runtime_tasks
  set status=p_status,
      output=case when p_status='SUCCESS' and p_verified then p_output else output end,
      verified=(p_status='SUCCESS' and p_verified),
      error_code=case when p_status in ('FAILED','BLOCKED','RETRYING') then left(p_error_code,100) else null end,
      error_message=case when p_status in ('FAILED','BLOCKED','RETRYING') then left(p_error_message,500) else null end,
      available_at=case when p_status='RETRYING' then coalesce(p_retry_at,now()+interval '1 minute') else available_at end,
      lease_until=null, lock_token=null,
      completed_at=case when p_status in ('SUCCESS','FAILED','BLOCKED','WAITING_FOR_APPROVAL') then now() else null end,
      updated_at=now()
  where task_id=p_task_id returning * into v_task;
  return v_task;
end $$;

revoke all on function public.enqueue_ai_runtime_task(text,text,jsonb,text,text,text) from public, anon, authenticated;
revoke all on function public.claim_ai_runtime_tasks(text,integer,integer) from public, anon, authenticated;
revoke all on function public.finish_ai_runtime_task(uuid,uuid,text,jsonb,text,text,boolean,timestamptz) from public, anon, authenticated;
grant execute on function public.enqueue_ai_runtime_task(text,text,jsonb,text,text,text) to service_role;
grant execute on function public.claim_ai_runtime_tasks(text,integer,integer) to service_role;
grant execute on function public.finish_ai_runtime_task(uuid,uuid,text,jsonb,text,text,boolean,timestamptz) to service_role;


create or replace function public.ai_runtime_admin_snapshot()
returns jsonb
language sql stable security definer set search_path = pg_catalog, public as $$
  select jsonb_build_object(
    'teams', coalesce((
      select jsonb_agg(to_jsonb(summary) order by summary.category)
      from (
        select t.team_id as "teamId", t.category, t.name, t.purpose, t.lifecycle, t.enabled,
          t.runtime_status as "runtimeStatus", t.required_integrations as "requiredIntegrations",
          t.safe_actions as "safeActions", t.risk, t.requires_approval as "requiresApproval",
          t.block_reason as "blockReason", t.last_execution_at as "lastExecutionAt",
          t.last_error as "lastError", t.updated_at as "updatedAt",
          coalesce(c.queued_count,0) as "queuedTasks", coalesce(c.running_count,0) as "runningTasks",
          coalesce(c.waiting_count,0) as "waitingTasks", coalesce(c.approval_count,0) as "approvalTasks",
          coalesce(c.blocked_count,0) as "blockedTasks", coalesce(c.failed_count,0) as "failedTasks",
          coalesce(c.success_count,0) as "successTasks"
        from public.ai_runtime_teams t
        left join lateral (
          select count(*) filter (where status in ('NEW','QUEUED','RETRYING')) as queued_count,
            count(*) filter (where status='PROCESSING') as running_count,
            count(*) filter (where status='WAITING') as waiting_count,
            count(*) filter (where status in ('WAITING_FOR_APPROVAL','APPROVED')) as approval_count,
            count(*) filter (where status='BLOCKED') as blocked_count,
            count(*) filter (where status='FAILED') as failed_count,
            count(*) filter (where status='SUCCESS') as success_count
          from public.ai_runtime_tasks x where x.team_id=t.team_id
        ) c on true
      ) summary
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(to_jsonb(recent) order by recent."createdAt" desc)
      from (
        select task_id as id, team_id as "teamId", agent_id as "agentId", action, status,
          verified, error_code as "errorCode", error_message as "errorMessage",
          attempt_count as "attemptCount", max_attempts as "maxAttempts",
          request_id as "requestId", approval_id as "approvalId", audit_id as "auditId",
          created_at as "createdAt", updated_at as "updatedAt", completed_at as "completedAt"
        from public.ai_runtime_tasks order by created_at desc limit 100
      ) recent
    ), '[]'::jsonb),
    'approvals', coalesce((
      select jsonb_agg(to_jsonb(a) order by a."createdAt" desc)
      from (
        select approval_id as id, task_id as "taskId", requested_by as "requestedBy",
          required_role as "requiredRole", status, approved_by as "approvedBy", reason,
          created_at as "createdAt", expires_at as "expiresAt", decided_at as "decidedAt"
        from public.ai_runtime_approvals order by created_at desc limit 100
      ) a
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e."createdAt" desc)
      from (
        select event_id as id, source, event_type as "eventType", status,
          retry_count as "retryCount", audit_reference as "auditReference", created_at as "createdAt", processed_at as "processedAt"
        from public.ai_runtime_events order by created_at desc limit 100
      ) e
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(to_jsonb(audit) order by audit."createdAt" desc)
      from (
        select audit_id as id, actor_type as "actorType", actor_id as "actorId", team_id as "teamId",
          agent_id as "agentId", task_id as "taskId", action, resource, result, error_code as "errorCode",
          error_message as "errorMessage", request_id as "requestId", approval_id as "approvalId", created_at as "createdAt"
        from public.ai_runtime_audit order by created_at desc limit 100
      ) audit
    ), '[]'::jsonb),
    'integrations', coalesce((
      select jsonb_agg(jsonb_build_object('id', integration_id, 'name', display_name, 'state', state,
        'checkedAt', checked_at, 'lastErrorCode', last_error_code, 'lastError', last_error, 'metadata', metadata) order by integration_id)
      from public.ai_runtime_integrations
    ), '[]'::jsonb),
    'health', coalesce((
      select jsonb_agg(to_jsonb(h) order by h."checkedAt" desc)
      from (
        select distinct on (component) component, state, checked_at as "checkedAt", latency_ms as "latencyMs",
          details, error_code as "errorCode"
        from public.ai_runtime_health order by component, checked_at desc limit 100
      ) h
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'teamCount', (select count(*) from public.ai_runtime_teams),
      'agentCount', (select count(*) from public.ai_runtime_agents),
      'queuedCount', (select count(*) from public.ai_runtime_tasks where status in ('NEW','QUEUED','RETRYING')),
      'runningCount', (select count(*) from public.ai_runtime_tasks where status='PROCESSING'),
      'approvalCount', (select count(*) from public.ai_runtime_tasks where status in ('WAITING_FOR_APPROVAL','APPROVED')),
      'blockedCount', (select count(*) from public.ai_runtime_tasks where status='BLOCKED'),
      'failedCount', (select count(*) from public.ai_runtime_tasks where status='FAILED'),
      'successCount', (select count(*) from public.ai_runtime_tasks where status='SUCCESS'),
      'pendingApprovalCount', (select count(*) from public.ai_runtime_approvals where status='PENDING' and expires_at > now())
    )
  );
$$;
revoke all on function public.ai_runtime_admin_snapshot() from public, anon, authenticated;
grant execute on function public.ai_runtime_admin_snapshot() to service_role;


-- Final function definitions add audit/notification writes in the same transaction as task state changes.
create or replace function public.enqueue_ai_runtime_task(
  p_team_id text,
  p_action text,
  p_input jsonb,
  p_actor_id text,
  p_idempotency_key text,
  p_request_id text default null
) returns public.ai_runtime_tasks
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_task public.ai_runtime_tasks; v_audit_id uuid;
begin
  if length(coalesce(p_action,'')) not between 1 and 80 then raise exception 'invalid_action'; end if;
  if length(coalesce(p_actor_id,'')) not between 1 and 180 then raise exception 'invalid_actor'; end if;
  if length(coalesce(p_idempotency_key,'')) not between 8 and 160 then raise exception 'invalid_idempotency_key'; end if;
  if pg_column_size(coalesce(p_input, '{}'::jsonb)) > 32768 then raise exception 'task_input_too_large'; end if;
  if not exists (select 1 from public.ai_runtime_teams t where t.team_id=p_team_id and t.enabled=true and t.lifecycle='ACTIVE' and p_action=any(t.safe_actions)) then raise exception 'team_not_active_or_action_not_allowlisted'; end if;
  if exists (
    select 1 from public.ai_runtime_teams t
    cross join lateral unnest(t.required_integrations) required(integration_id)
    left join public.ai_runtime_integrations i on i.integration_id=required.integration_id
    where t.team_id=p_team_id and (
      coalesce(i.state,'NOT_CONFIGURED') <> 'CONNECTED'
      or (required.integration_id='ai-provider' and (i.checked_at is null or i.checked_at <= now()-interval '15 minutes'))
    )
  ) then raise exception 'required_integration_not_verified'; end if;

  insert into public.ai_runtime_tasks(team_id, agent_id, action, actor_id, idempotency_key, status, input, request_id)
  values(p_team_id, p_team_id || '-primary', p_action, p_actor_id, p_idempotency_key, 'QUEUED', coalesce(p_input,'{}'::jsonb), p_request_id)
  on conflict (team_id, actor_id, idempotency_key) do nothing
  returning * into v_task;
  if not found then
    select * into v_task from public.ai_runtime_tasks
    where team_id=p_team_id and actor_id=p_actor_id and idempotency_key=p_idempotency_key;
    return v_task;
  end if;

  insert into public.ai_runtime_audit(actor_type, actor_id, team_id, agent_id, task_id, action, resource, result, request_id, after_state)
  values('admin', p_actor_id, p_team_id, v_task.agent_id, v_task.task_id, 'task.enqueue', 'ai_runtime_tasks', 'ALLOW', p_request_id,
    jsonb_build_object('status','QUEUED','action',p_action)) returning audit_id into v_audit_id;
  update public.ai_runtime_tasks set audit_id=v_audit_id where task_id=v_task.task_id returning * into v_task;
  update public.ai_runtime_teams set runtime_status='QUEUED', block_reason='', updated_at=now() where team_id=p_team_id;
  return v_task;
end $$;

create or replace function public.finish_ai_runtime_task(
  p_task_id uuid,
  p_lock_token uuid,
  p_status text,
  p_output jsonb default null,
  p_error_code text default null,
  p_error_message text default null,
  p_verified boolean default false,
  p_retry_at timestamptz default null
) returns public.ai_runtime_tasks
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_task public.ai_runtime_tasks; v_audit_id uuid; v_result text;
begin
  if p_status not in ('SUCCESS','FAILED','BLOCKED','WAITING','WAITING_FOR_APPROVAL','RETRYING') then raise exception 'invalid_finish_status'; end if;
  if p_status='SUCCESS' and coalesce(p_verified,false) is not true then raise exception 'success_requires_verification'; end if;

  select * into v_task from public.ai_runtime_tasks
  where task_id=p_task_id and status='PROCESSING' and lock_token=p_lock_token and lease_until > now()
  for update;
  if not found then raise exception 'task_lease_not_owned'; end if;
  if p_status='RETRYING' and v_task.attempt_count >= v_task.max_attempts then p_status := 'FAILED'; end if;

  update public.ai_runtime_tasks
  set status=p_status,
      output=case when p_status='SUCCESS' and p_verified then p_output else output end,
      verified=(p_status='SUCCESS' and p_verified),
      error_code=case when p_status in ('FAILED','BLOCKED','RETRYING','WAITING_FOR_APPROVAL') then left(p_error_code,100) else null end,
      error_message=case when p_status in ('FAILED','BLOCKED','RETRYING','WAITING_FOR_APPROVAL') then left(p_error_message,500) else null end,
      available_at=case when p_status='RETRYING' then coalesce(p_retry_at,now()+interval '1 minute') else available_at end,
      lease_until=null, lock_token=null,
      completed_at=case when p_status in ('SUCCESS','FAILED','BLOCKED','WAITING_FOR_APPROVAL') then now() else null end,
      updated_at=now()
  where task_id=p_task_id returning * into v_task;

  v_result := case when p_status='WAITING' then 'BLOCKED' else p_status end;
  insert into public.ai_runtime_audit(actor_type, actor_id, team_id, agent_id, task_id, action, resource, result, error_code, error_message, request_id, approval_id, before_state, after_state)
  values('agent', v_task.actor_id, v_task.team_id, v_task.agent_id, v_task.task_id, 'task.finish', 'ai_runtime_tasks', v_result,
    v_task.error_code, v_task.error_message, v_task.request_id, v_task.approval_id,
    jsonb_build_object('status','PROCESSING'), jsonb_build_object('status',p_status,'verified',v_task.verified))
  returning audit_id into v_audit_id;
  update public.ai_runtime_tasks set audit_id=v_audit_id where task_id=p_task_id returning * into v_task;

  update public.ai_runtime_teams set
    runtime_status=case p_status when 'SUCCESS' then 'SUCCESS' when 'FAILED' then 'FAILED' when 'RETRYING' then 'RETRYING' when 'WAITING' then 'WAITING' when 'WAITING_FOR_APPROVAL' then 'WAITING_FOR_APPROVAL' else 'BLOCKED' end,
    last_execution_at=case when p_status in ('SUCCESS','FAILED','BLOCKED') then now() else last_execution_at end,
    last_error=case when p_status in ('FAILED','BLOCKED','WAITING_FOR_APPROVAL') then left(p_error_message,500) else null end,
    block_reason=case when p_status='BLOCKED' then left(coalesce(p_error_code,'EXECUTION_BLOCKED'),100) else '' end,
    updated_at=now()
  where team_id=v_task.team_id;

  if p_status in ('FAILED','BLOCKED','WAITING_FOR_APPROVAL') then
    insert into public.ai_runtime_notifications(dedupe_key, severity, title, body, team_id, task_id)
    values(v_task.task_id::text || ':' || p_status,
      case when p_status='WAITING_FOR_APPROVAL' then 'HIGH' else 'WARNING' end,
      case p_status when 'WAITING_FOR_APPROVAL' then 'Agent task needs approval' when 'BLOCKED' then 'Agent task is blocked' else 'Agent task failed' end,
      left(coalesce(p_error_message,p_error_code,'Review the task audit record.'),500), v_task.team_id, v_task.task_id)
    on conflict (dedupe_key) do nothing;
  end if;
  return v_task;
end $$;

revoke all on function public.enqueue_ai_runtime_task(text,text,jsonb,text,text,text) from public, anon, authenticated;
revoke all on function public.finish_ai_runtime_task(uuid,uuid,text,jsonb,text,text,boolean,timestamptz) from public, anon, authenticated;
grant execute on function public.enqueue_ai_runtime_task(text,text,jsonb,text,text,text) to service_role;
grant execute on function public.finish_ai_runtime_task(uuid,uuid,text,jsonb,text,text,boolean,timestamptz) to service_role;


create or replace function public.approve_and_activate_ai_runtime_team(
  p_team_id text,
  p_actor_id text,
  p_request_id text default null
) returns public.ai_runtime_teams
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_team public.ai_runtime_teams; v_previous text;
begin
  if p_team_id not in ('content-writer','translator-voice') then raise exception 'team_activation_not_allowed'; end if;
  if length(coalesce(p_actor_id,'')) not between 1 and 180 then raise exception 'invalid_actor'; end if;
  select * into v_team from public.ai_runtime_teams where team_id=p_team_id for update;
  if not found then raise exception 'team_not_found'; end if;
  if v_team.risk <> 'LOW' or v_team.requires_approval then raise exception 'team_requires_separate_approval_workflow'; end if;
  if exists (
    select 1 from unnest(v_team.required_integrations) required(id)
    left join public.ai_runtime_integrations i on i.integration_id=required.id
    where coalesce(i.state,'NOT_CONFIGURED') <> 'CONNECTED'
      or (required.id='ai-provider' and (i.checked_at is null or i.checked_at <= now()-interval '15 minutes'))
  ) then raise exception 'required_integration_not_verified'; end if;

  v_previous := v_team.lifecycle;
  if v_team.lifecycle = 'DRAFT' then
    update public.ai_runtime_teams set lifecycle='TESTING', runtime_status='BLOCKED', block_reason='AWAITING_ADMIN_ACTIVATION', updated_at=now() where team_id=p_team_id;
    insert into public.ai_runtime_audit(actor_type,actor_id,team_id,agent_id,action,resource,result,request_id,before_state,after_state)
    values('admin',p_actor_id,p_team_id,p_team_id||'-primary','team.lifecycle.testing','ai_runtime_teams','ALLOW',p_request_id,
      jsonb_build_object('lifecycle',v_previous),jsonb_build_object('lifecycle','TESTING'));
    v_previous := 'TESTING';
  end if;
  if v_previous = 'TESTING' then
    update public.ai_runtime_teams set lifecycle='APPROVED', updated_at=now() where team_id=p_team_id;
    insert into public.ai_runtime_audit(actor_type,actor_id,team_id,agent_id,action,resource,result,request_id,before_state,after_state)
    values('admin',p_actor_id,p_team_id,p_team_id||'-primary','team.lifecycle.approve','ai_runtime_teams','ALLOW',p_request_id,
      jsonb_build_object('lifecycle','TESTING'),jsonb_build_object('lifecycle','APPROVED'));
    v_previous := 'APPROVED';
  end if;
  if v_previous <> 'APPROVED' then raise exception 'invalid_team_lifecycle'; end if;

  update public.ai_runtime_teams set lifecycle='ACTIVE', enabled=true, runtime_status='READY', block_reason='', last_error=null, updated_at=now()
  where team_id=p_team_id;
  update public.ai_runtime_agents set lifecycle='ACTIVE', enabled=true, updated_at=now() where team_id=p_team_id;
  insert into public.ai_runtime_audit(actor_type,actor_id,team_id,agent_id,action,resource,result,request_id,before_state,after_state)
  values('admin',p_actor_id,p_team_id,p_team_id||'-primary','team.activate','ai_runtime_teams','ALLOW',p_request_id,
    jsonb_build_object('lifecycle','APPROVED','enabled',false),jsonb_build_object('lifecycle','ACTIVE','enabled',true));
  select * into v_team from public.ai_runtime_teams where team_id=p_team_id;
  return v_team;
end $$;
revoke all on function public.approve_and_activate_ai_runtime_team(text,text,text) from public, anon, authenticated;
grant execute on function public.approve_and_activate_ai_runtime_team(text,text,text) to service_role;
