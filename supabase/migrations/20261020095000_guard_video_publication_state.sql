-- Authenticated clients may create their own private processing rows, but they
-- must never decide moderation, processing, deletion, or public publication state.
-- Trusted service-role processing/moderation workers own those transitions.
create or replace function public.hktube_guard_video_publication_state()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth
as $function$
declare
  v_jwt_role text := coalesce(auth.role(), '');
  v_field text;
  v_protected_fields text[] := array[
    'creator_id',
    'channel_id',
    'video_path',
    'thumbnail_path',
    'moderation_status',
    'status',
    'visibility',
    'published_at',
    'media_processing_status',
    'media_processing_error',
    'mux_asset_id',
    'moderation_reason',
    'moderation_confidence',
    'moderation_checked_at',
    'copyright_status',
    'copyright_confidence',
    'duplicate_score',
    'content_fingerprint',
    'detection_engine_version',
    'review_required',
    'deleted_at'
  ];
  v_video_path text;
  v_thumbnail_path text;
begin
  -- A signed service-role request is a trusted control-plane actor. A database
  -- owner executing a SECURITY DEFINER function on behalf of an end user is
  -- deliberately NOT trusted here: auth.uid() remains set for that user.
  if v_jwt_role = 'service_role' then
    return new;
  end if;

  -- Permit trusted SQL maintenance and server-owned DB connections only when
  -- there is no end-user identity attached to the transaction.
  if auth.uid() is null and current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if v_jwt_role <> 'authenticated' or auth.uid() is null then
    raise insufficient_privilege using message = 'Video publication state is server-managed.';
  end if;

  if tg_op = 'INSERT' then
    if new.creator_id is distinct from auth.uid() then
      raise insufficient_privilege using message = 'A user may only create their own video.';
    end if;

    if new.visibility is distinct from 'private'
       or new.status is distinct from 'processing'
       or new.moderation_status is distinct from 'pending'
       or new.published_at is not null then
      raise insufficient_privilege using message = 'New videos must remain private and pending server processing.';
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

-- Replace the repository's known public-read policy names with the strict
-- approved-public-or-owner predicate. PostgreSQL combines permissive policies
-- with OR, so remove every existing policy on these two tables before creating
-- the exact intended policy set below.
alter table public.videos enable row level security;
do $policies$
declare
  v_policy record;
begin
  for v_policy in
    select policyname from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'videos'
  loop
    execute format('drop policy if exists %I on public.videos', v_policy.policyname);
  end loop;
end
$policies$;
create policy "hktube_videos_public_read"
on public.videos for select to anon, authenticated
using (
  (visibility = 'public' and status = 'published' and moderation_status = 'approved')
  or creator_id = auth.uid()
);
create policy "hktube_videos_owner_insert"
on public.videos for insert to authenticated
with check (creator_id = auth.uid());
create policy "hktube_videos_owner_update"
on public.videos for update to authenticated
using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy "hktube_videos_owner_delete"
on public.videos for delete to authenticated
using (creator_id = auth.uid());
grant select on public.videos to anon, authenticated;
grant insert, update, delete on public.videos to authenticated;


-- The RLS baseline exposes approved comments publicly. Do not let a browser
-- bypass the moderation pipeline by inserting or approving a comment directly.
create or replace function public.hktube_guard_comment_moderation_state()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth
as $function$
declare
  v_jwt_role text := coalesce(auth.role(), '');
  v_field text;
  v_protected_fields text[] := array[
    'author_id','moderation_status','moderation_reason','moderated_at',
    'moderated_by','status','deleted_at'
  ];
begin
  if v_jwt_role = 'service_role' then return new; end if;
  if auth.uid() is null and current_user in ('postgres', 'supabase_admin') then return new; end if;
  if v_jwt_role <> 'authenticated' or auth.uid() is null then
    raise insufficient_privilege using message = 'Comment moderation state is server-managed.';
  end if;

  if tg_op = 'INSERT' then
    -- Normalize these fields instead of relying on caller/RPC defaults. This
    -- prevents spoofing/self-approval and keeps inserts compatible with older
    -- RPCs whose table defaults may still say "approved".
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

alter table public.comments enable row level security;
do $policies$
declare
  v_policy record;
begin
  for v_policy in
    select policyname from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'comments'
  loop
    execute format('drop policy if exists %I on public.comments', v_policy.policyname);
  end loop;
end
$policies$;
create policy "hktube_comments_public_read"
on public.comments for select to anon, authenticated
using (moderation_status = 'approved' or author_id = auth.uid());
create policy "hktube_comments_owner_insert"
on public.comments for insert to authenticated
with check (author_id = auth.uid());
create policy "hktube_comments_owner_update"
on public.comments for update to authenticated
using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "hktube_comments_owner_delete"
on public.comments for delete to authenticated
using (author_id = auth.uid());
grant select on public.comments to anon, authenticated;
grant insert, update, delete on public.comments to authenticated;
