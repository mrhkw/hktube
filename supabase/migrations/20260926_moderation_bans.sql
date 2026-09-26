alter table public.profiles
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_at timestamptz,
  add column if not exists ban_reason text;

create index if not exists profiles_banned_idx on public.profiles(is_banned) where is_banned = true;

drop policy if exists "hktube_videos_public_approved" on public.videos;
create policy "hktube_videos_public_approved"
on public.videos for select to public
using (
  (
    visibility = 'public'
    and status = 'published'
    and moderation_status = 'approved'
    and deleted_at is null
    and not exists (
      select 1 from public.profiles p
      where p.id = creator_id and p.is_banned = true
    )
  )
  or creator_id = auth.uid()
);

create or replace function public.ban_user(
  p_user_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.moderation_admin() then raise exception 'Admin access required'; end if;
  if p_user_id = auth.uid() then raise exception 'An administrator cannot ban their own account'; end if;

  update public.profiles
  set is_banned = true, banned_at = now(), ban_reason = nullif(left(coalesce(p_reason,''),1000),'')
  where id = p_user_id;

  if not found then raise exception 'User not found'; end if;

  update public.videos
  set moderation_status = 'rejected',
      moderation_reason = coalesce(nullif(left(coalesce(p_reason,''),1000),''),'Account banned'),
      moderation_checked_at = now(),
      deleted_at = coalesce(deleted_at, now())
  where creator_id = p_user_id and deleted_at is null;

  insert into public.moderation_actions(moderator_id,target_type,target_id,action,reason,metadata)
  values(auth.uid(),'user',p_user_id,'ban_user',p_reason,'{"source":"admin_moderation"}'::jsonb);

  return true;
end;
$$;

revoke all on function public.ban_user(uuid,text) from public;
grant execute on function public.ban_user(uuid,text) to authenticated;
