-- HkTube media and engagement security baseline.
-- Idempotent for the existing public.videos/public.comments schema.
-- Run this in Supabase SQL Editor before enabling the updated client.

alter table if exists public.videos
  add column if not exists is_short boolean not null default false;

create index if not exists videos_public_shorts_idx
  on public.videos (published_at desc)
  where visibility = 'public'
    and status = 'published'
    and moderation_status = 'approved'
    and is_short = true;

alter table if exists public.videos enable row level security;
alter table if exists public.comments enable row level security;

-- PostgreSQL ORs permissive policies together; remove all prior policies for
-- these two tables before installing the complete policy set below.
do $$
declare
  v_policy record;
begin
  if to_regclass('public.videos') is not null then
    for v_policy in select policyname from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'videos' loop
      execute format('drop policy if exists %I on public.videos', v_policy.policyname);
    end loop;
  end if;
  if to_regclass('public.comments') is not null then
    for v_policy in select policyname from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'comments' loop
      execute format('drop policy if exists %I on public.comments', v_policy.policyname);
    end loop;
  end if;
end $$;

drop policy if exists "hktube_public_read_published_videos" on public.videos;
create policy "hktube_public_read_published_videos"
on public.videos for select
to anon, authenticated
using (
  (visibility = 'public' and status = 'published' and moderation_status = 'approved')
  or creator_id = auth.uid()
);

drop policy if exists "hktube_owner_insert_videos" on public.videos;
create policy "hktube_owner_insert_videos"
on public.videos for insert
to authenticated
with check (creator_id = auth.uid());

drop policy if exists "hktube_owner_update_videos" on public.videos;
create policy "hktube_owner_update_videos"
on public.videos for update
to authenticated
using (creator_id = auth.uid())
with check (creator_id = auth.uid());

drop policy if exists "hktube_owner_delete_videos" on public.videos;
create policy "hktube_owner_delete_videos"
on public.videos for delete
to authenticated
using (creator_id = auth.uid());
grant select on public.videos to anon, authenticated;
grant insert, update, delete on public.videos to authenticated;

drop policy if exists "hktube_public_read_approved_comments" on public.comments;
create policy "hktube_public_read_approved_comments"
on public.comments for select
to anon, authenticated
using (moderation_status = 'approved' or author_id = auth.uid());

drop policy if exists "hktube_authenticated_insert_comments" on public.comments;
create policy "hktube_authenticated_insert_comments"
on public.comments for insert
to authenticated
with check (author_id = auth.uid());

drop policy if exists "hktube_comment_author_update" on public.comments;
create policy "hktube_comment_author_update"
on public.comments for update
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

drop policy if exists "hktube_comment_author_delete" on public.comments;
create policy "hktube_comment_author_delete"
on public.comments for delete
to authenticated
using (author_id = auth.uid());
grant select on public.comments to anon, authenticated;
grant insert, update, delete on public.comments to authenticated;

create table if not exists public.dislikes (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create index if not exists dislikes_video_id_idx
  on public.dislikes (video_id);

alter table public.dislikes enable row level security;

drop policy if exists "hktube_public_read_dislikes" on public.dislikes;
create policy "hktube_public_read_dislikes"
on public.dislikes for select
to anon, authenticated
using (true);

drop policy if exists "hktube_owner_insert_dislikes" on public.dislikes;
create policy "hktube_owner_insert_dislikes"
on public.dislikes for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "hktube_owner_delete_dislikes" on public.dislikes;
create policy "hktube_owner_delete_dislikes"
on public.dislikes for delete
to authenticated
using (user_id = auth.uid());

grant select on public.videos to anon, authenticated;
grant insert, update, delete on public.videos to authenticated;
grant select on public.comments to anon, authenticated;
grant insert, update, delete on public.comments to authenticated;
grant select on public.dislikes to anon, authenticated;
grant insert, delete on public.dislikes to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;
end
$$;


-- Required publication-state guard; same invariant is also installed by the
-- timestamped migration and the comprehensive security-hardening SQL script.
create or replace function public.hktube_guard_video_publication_state()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth
as $function$
declare
  v_jwt_role text := coalesce(auth.role(), '');
  v_field text;
  v_protected_fields text[] := array[
    'creator_id','channel_id','video_path','thumbnail_path','moderation_status',
    'status','visibility','published_at','media_processing_status',
    'media_processing_error','mux_asset_id','moderation_reason',
    'moderation_confidence','moderation_checked_at','copyright_status',
    'copyright_confidence','duplicate_score','content_fingerprint',
    'detection_engine_version','review_required','deleted_at'
  ];
  v_video_path text;
  v_thumbnail_path text;
begin
  if v_jwt_role = 'service_role' then return new; end if;
  if auth.uid() is null and current_user in ('postgres', 'supabase_admin') then return new; end if;
  if v_jwt_role <> 'authenticated' or auth.uid() is null then
    raise insufficient_privilege using message = 'Video publication state is server-managed.';
  end if;
  if tg_op = 'INSERT' then
    if new.creator_id is distinct from auth.uid()
       or new.visibility is distinct from 'private'
       or new.status is distinct from 'processing'
       or new.moderation_status is distinct from 'pending'
       or new.published_at is not null then
      raise insufficient_privilege using message = 'New videos must be owned by the uploader and remain private/pending.';
    end if;
    v_video_path := to_jsonb(new) ->> 'video_path';
    v_thumbnail_path := to_jsonb(new) ->> 'thumbnail_path';
    if v_video_path is null or v_video_path not like auth.uid()::text || '/%' then
      raise insufficient_privilege using message = 'Video storage paths must belong to the authenticated uploader.';
    end if;
    if v_thumbnail_path is not null and v_thumbnail_path not like auth.uid()::text || '/%' then
      raise insufficient_privilege using message = 'Thumbnail storage paths must belong to the authenticated uploader.';
    end if;
    return new;
  end if;
  if old.creator_id is distinct from auth.uid() or new.creator_id is distinct from auth.uid() then
    raise insufficient_privilege using message = 'A user may only update their own video.';
  end if;
  foreach v_field in array v_protected_fields loop
    if (to_jsonb(new) -> v_field) is distinct from (to_jsonb(old) -> v_field) then
      raise insufficient_privilege using message = 'Video publication and moderation state is server-managed.';
    end if;
  end loop;
  return new;
end
$function$;

revoke execute on function public.hktube_guard_video_publication_state() from public, anon, authenticated;
drop trigger if exists hktube_guard_video_publication_state on public.videos;
create trigger hktube_guard_video_publication_state
before insert or update on public.videos
for each row execute function public.hktube_guard_video_publication_state();


-- Do not let direct PostgREST writes bypass the server-side comment moderation path.
create or replace function public.hktube_guard_comment_moderation_state()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth
as $function$
declare
  v_jwt_role text := coalesce(auth.role(), '');
  v_field text;
  v_protected_fields text[] := array['author_id','moderation_status','moderation_reason','moderated_at','moderated_by','status','deleted_at'];
begin
  if v_jwt_role = 'service_role' then return new; end if;
  if auth.uid() is null and current_user in ('postgres', 'supabase_admin') then return new; end if;
  if v_jwt_role <> 'authenticated' or auth.uid() is null then
    raise insufficient_privilege using message = 'Comment moderation state is server-managed.';
  end if;
  if tg_op = 'INSERT' then
    -- Force authenticated inserts into a safe initial moderation state, even
    -- if an old RPC or client submits an unsafe value/default.
    new.author_id := auth.uid();
    new.moderation_status := 'pending';
    return new;
  end if;
  if (to_jsonb(old) ->> 'author_id') is distinct from auth.uid()::text
     or (to_jsonb(new) ->> 'author_id') is distinct from auth.uid()::text then
    raise insufficient_privilege using message = 'A user may only update their own comment.';
  end if;
  foreach v_field in array v_protected_fields loop
    if (to_jsonb(new) -> v_field) is distinct from (to_jsonb(old) -> v_field) then
      raise insufficient_privilege using message = 'Comment moderation state is server-managed.';
    end if;
  end loop;
  return new;
end
$function$;
revoke execute on function public.hktube_guard_comment_moderation_state() from public, anon, authenticated;
drop trigger if exists hktube_guard_comment_moderation_state on public.comments;
create trigger hktube_guard_comment_moderation_state
before insert or update on public.comments
for each row execute function public.hktube_guard_comment_moderation_state();
