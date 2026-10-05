create table if not exists public.moderation_decision_notices (id uuid primary key default gen_random_uuid(), video_id uuid references public.videos(id) on delete set null, creator_id uuid, action text not null, reason_code text not null, reason text not null, policy_version text not null, automated boolean not null default true, source text not null default 'safety_engine', created_at timestamptz not null default now(), appeal_deadline timestamptz, status text not null default 'active' check (status in ('active','appealed','reversed','expired')), metadata jsonb not null default '{}'::jsonb);
create index if not exists moderation_notices_creator_created_idx on public.moderation_decision_notices(creator_id, created_at desc);
create index if not exists moderation_notices_video_created_idx on public.moderation_decision_notices(video_id, created_at desc);
alter table public.moderation_decision_notices enable row level security;
revoke all on public.moderation_decision_notices from anon, authenticated;
grant select on public.moderation_decision_notices to authenticated;
grant all on public.moderation_decision_notices to service_role;
drop policy if exists moderation_notice_creator_read on public.moderation_decision_notices;
create policy moderation_notice_creator_read on public.moderation_decision_notices for select to authenticated using (creator_id = auth.uid());
create table if not exists public.moderation_audit_chain (id bigint generated always as identity primary key, event_type text not null, target_type text not null, target_id uuid, actor_id uuid, previous_hash text, event_hash text not null, payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create index if not exists moderation_audit_chain_target_idx on public.moderation_audit_chain(target_type, target_id, created_at desc);
alter table public.moderation_audit_chain enable row level security;
revoke all on public.moderation_audit_chain from anon, authenticated;
grant all on public.moderation_audit_chain to service_role;
create table if not exists public.privacy_erasure_requests (id uuid primary key default gen_random_uuid(), subject_id uuid, video_id uuid references public.videos(id) on delete set null, request_type text not null check (request_type in ('video','account','transcript','moderation_evidence','export')), status text not null default 'requested' check (status in ('requested','processing','completed','failed','blocked_legal_hold')), requested_at timestamptz not null default now(), completed_at timestamptz, legal_hold boolean not null default false, provider_status jsonb not null default '{}'::jsonb, metadata jsonb not null default '{}'::jsonb);
create index if not exists privacy_erasure_requests_status_idx on public.privacy_erasure_requests(status, requested_at);
alter table public.privacy_erasure_requests enable row level security;
revoke all on public.privacy_erasure_requests from anon, authenticated;
grant all on public.privacy_erasure_requests to service_role;
create or replace function public.hktube_record_moderation_notice() returns trigger language plpgsql security definer set search_path = pg_catalog, public as $function$
declare v_creator uuid; v_code text; v_policy text;
begin
  if NEW.target_type <> 'video' or NEW.action not like 'automated_%' then return NEW; end if;
  select creator_id into v_creator from public.videos where id=NEW.target_id;
  v_code := coalesce(NEW.metadata->>'reason_code', case when NEW.action='automated_remove' then 'AUTOMATED_REMOVE' else 'AUTOMATED_DECISION' end);
  v_policy := coalesce(NEW.metadata->>'policy_version','hktube-policy-2026-10-05');
  insert into public.moderation_decision_notices(video_id,creator_id,action,reason_code,reason,policy_version,automated,source,metadata) values(NEW.target_id,v_creator,NEW.action,v_code,coalesce(NEW.reason,'Automated moderation decision'),v_policy,true,'safety_engine',coalesce(NEW.metadata,'{}'::jsonb));
  insert into public.moderation_audit_chain(event_type,target_type,target_id,actor_id,previous_hash,event_hash,payload) values('moderation_notice','video',NEW.target_id,NEW.moderator_id,null,encode(gen_random_bytes(16),'hex'),jsonb_build_object('action',NEW.action,'reason_code',v_code,'policy_version',v_policy,'source','safety_engine'));
  return NEW;
end
$function$;
drop trigger if exists hktube_moderation_notice_after_action on public.moderation_actions;
create trigger hktube_moderation_notice_after_action after insert on public.moderation_actions for each row execute function public.hktube_record_moderation_notice();
revoke execute on function public.hktube_record_moderation_notice() from public, anon, authenticated;
grant execute on function public.hktube_record_moderation_notice() to service_role;
