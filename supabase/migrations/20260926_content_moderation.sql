create extension if not exists pgcrypto;

do $$ begin
  create type public.report_status as enum ('pending','reviewed','dismissed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.report_reason as enum (
    'nudity_sexual',
    'religious_hate',
    'violence_unlawful',
    'spam_fake',
    'child_abuse',
    'copyright',
    'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.moderation_action_type as enum ('delete_video','ban_user','dismiss_report','approve_video','reject_video','flag_video');
exception when duplicate_object then null;
end $$;

alter table public.videos
  add column if not exists moderation_reason text,
  add column if not exists moderation_checked_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists videos_public_moderation_idx
  on public.videos (moderation_status, visibility, status, created_at desc)
  where deleted_at is null;

create index if not exists reports_status_created_idx
  on public.reports (status, created_at asc);

create index if not exists moderation_actions_target_idx
  on public.moderation_actions (target_type, target_id, created_at desc);

create index if not exists user_blocks_blocker_idx
  on public.user_blocks (blocker_id, created_at desc);

alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.user_blocks enable row level security;
alter table public.videos enable row level security;

drop policy if exists "hktube_reports_insert_own" on public.reports;
create policy "hktube_reports_insert_own"
on public.reports for insert to authenticated
with check (reporter_id = auth.uid());

drop policy if exists "hktube_reports_select_own_or_admin" on public.reports;
create policy "hktube_reports_select_own_or_admin"
on public.reports for select to authenticated
using (
  reporter_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','moderator'))
);

drop policy if exists "hktube_user_blocks_own" on public.user_blocks;
create policy "hktube_user_blocks_own"
on public.user_blocks for all to authenticated
using (blocker_id = auth.uid())
with check (blocker_id = auth.uid() and blocker_id <> blocked_id);

drop policy if exists "hktube_moderation_actions_admin_read" on public.moderation_actions;
create policy "hktube_moderation_actions_admin_read"
on public.moderation_actions for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','moderator')));

create or replace function public.moderation_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','moderator')
  );
$$;

revoke all on function public.moderation_admin() from public;
grant execute on function public.moderation_admin() to authenticated;

create or replace function public.moderate_video(
  p_video_id uuid,
  p_moderation_status text,
  p_reason text default null
)
returns public.videos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_video public.videos;
begin
  if not public.moderation_admin() then
    raise exception 'Admin access required';
  end if;

  if p_moderation_status not in ('pending','approved','rejected','flagged') then
    raise exception 'Invalid moderation status';
  end if;

  update public.videos
  set moderation_status = p_moderation_status,
      moderation_reason = nullif(left(coalesce(p_reason,''),1000),''),
      moderation_checked_at = now(),
      deleted_at = case when p_moderation_status in ('rejected','flagged') then coalesce(deleted_at, now()) else null end,
      published_at = case when p_moderation_status = 'approved' then coalesce(published_at, now()) else published_at end
  where id = p_video_id
  returning * into v_video;

  if v_video.id is null then raise exception 'Video not found'; end if;

  insert into public.moderation_actions(moderator_id,target_type,target_id,action,reason,metadata)
  values (
    auth.uid(),'video',p_video_id,
    case p_moderation_status
      when 'approved' then 'approve_video'
      when 'rejected' then 'delete_video'
      when 'flagged' then 'flag_video'
      else 'approve_video'
    end,
    p_reason,
    jsonb_build_object('status',p_moderation_status)
  );

  return v_video;
end;
$$;

revoke all on function public.moderate_video(uuid,text,text) from public;
grant execute on function public.moderate_video(uuid,text,text) to authenticated;

create or replace function public.resolve_video_report(
  p_report_id uuid,
  p_status text,
  p_action text default null,
  p_reason text default null
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports;
begin
  if not public.moderation_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('reviewed','dismissed') then raise exception 'Invalid report status'; end if;

  update public.reports
  set status = p_status, resolved_at = now()
  where id = p_report_id
  returning * into v_report;

  if v_report.id is null then raise exception 'Report not found'; end if;

  insert into public.moderation_actions(moderator_id,target_type,target_id,action,reason,metadata)
  values (
    auth.uid(),
    case when v_report.video_id is not null then 'video' when v_report.post_id is not null then 'post' when v_report.comment_id is not null then 'comment' else 'report' end,
    coalesce(v_report.video_id,v_report.post_id,v_report.comment_id,v_report.id),
    case when p_status='dismissed' then 'dismiss_report' else coalesce(p_action,'dismiss_report') end,
    p_reason,
    jsonb_build_object('report_id',p_report_id,'status',p_status)
  );

  return v_report;
end;
$$;

revoke all on function public.resolve_video_report(uuid,text,text,text) from public;
grant execute on function public.resolve_video_report(uuid,text,text,text) to authenticated;
