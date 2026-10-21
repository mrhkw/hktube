-- HkTube enterprise security hardening for the Supabase-backed surface.
-- Execute in Supabase SQL Editor with a role allowed to alter public tables.
-- All statements are idempotent and deliberately use auth.uid() ownership checks.

alter table if exists public.profiles enable row level security;
alter table if exists public.videos enable row level security;
alter table if exists public.comments enable row level security;
alter table if exists public.likes enable row level security;
alter table if exists public.video_likes enable row level security;

-- PostgreSQL ORs permissive policies together. Remove every pre-existing
-- policy for these application tables before rebuilding the explicit set.
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

-- Recreate the explicit policy set after removing legacy names. Missing tables
-- are handled by the guarded DO blocks below.
do $$
declare
  table_name text;
begin
  if to_regclass('public.profiles') is not null then
    execute 'drop policy if exists "hktube_profiles_public_read" on public.profiles';
    execute 'drop policy if exists "hktube_profiles_owner_insert" on public.profiles';
    execute 'drop policy if exists "hktube_profiles_owner_update" on public.profiles';
    execute 'create policy "hktube_profiles_public_read" on public.profiles for select to anon, authenticated using (true)';
    execute 'create policy "hktube_profiles_owner_insert" on public.profiles for insert to authenticated with check (id = auth.uid())';
    execute 'create policy "hktube_profiles_owner_update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid())';
    execute 'grant select on public.profiles to anon, authenticated';
    execute 'grant insert, update on public.profiles to authenticated';
  end if;

  if to_regclass('public.videos') is not null then
    execute 'drop policy if exists "hktube_videos_public_read" on public.videos';
    execute 'drop policy if exists "hktube_videos_owner_insert" on public.videos';
    execute 'drop policy if exists "hktube_videos_owner_update" on public.videos';
    execute 'drop policy if exists "hktube_videos_owner_delete" on public.videos';
    execute 'create policy "hktube_videos_public_read" on public.videos for select to anon, authenticated using ((visibility = ''public'' and status = ''published'' and moderation_status = ''approved'') or creator_id = auth.uid())';
    execute 'create policy "hktube_videos_owner_insert" on public.videos for insert to authenticated with check (creator_id = auth.uid())';
    execute 'create policy "hktube_videos_owner_update" on public.videos for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid())';
    execute 'create policy "hktube_videos_owner_delete" on public.videos for delete to authenticated using (creator_id = auth.uid())';
    execute 'grant select on public.videos to anon, authenticated';
    execute 'grant insert, update, delete on public.videos to authenticated';
  end if;

  if to_regclass('public.comments') is not null then
    execute 'drop policy if exists "hktube_comments_public_read" on public.comments';
    execute 'drop policy if exists "hktube_comments_owner_insert" on public.comments';
    execute 'drop policy if exists "hktube_comments_owner_update" on public.comments';
    execute 'drop policy if exists "hktube_comments_owner_delete" on public.comments';
    execute 'create policy "hktube_comments_public_read" on public.comments for select to anon, authenticated using (moderation_status = ''approved'' or author_id = auth.uid())';
    execute 'create policy "hktube_comments_owner_insert" on public.comments for insert to authenticated with check (author_id = auth.uid())';
    execute 'create policy "hktube_comments_owner_update" on public.comments for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid())';
    execute 'create policy "hktube_comments_owner_delete" on public.comments for delete to authenticated using (author_id = auth.uid())';
    execute 'grant select on public.comments to anon, authenticated';
    execute 'grant insert, update, delete on public.comments to authenticated';
  end if;

  foreach table_name in array['likes', 'video_likes'] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop policy if exists "hktube_%s_public_read" on public.%I', table_name, table_name);
      execute format('drop policy if exists "hktube_%s_owner_insert" on public.%I', table_name, table_name);
      execute format('drop policy if exists "hktube_%s_owner_delete" on public.%I', table_name, table_name);
      execute format('create policy "hktube_%s_public_read" on public.%I for select to anon, authenticated using (true)', table_name, table_name);
      execute format('create policy "hktube_%s_owner_insert" on public.%I for insert to authenticated with check (user_id = auth.uid())', table_name, table_name);
      execute format('create policy "hktube_%s_owner_delete" on public.%I for delete to authenticated using (user_id = auth.uid())', table_name, table_name);
      execute format('grant select on public.%I to anon, authenticated', table_name);
      execute format('grant insert, delete on public.%I to authenticated', table_name);
    end if;
  end loop;
end $$;


-- Prevent browser-authenticated owners from self-approving, publishing, or
-- changing server-controlled moderation/processing state on their video rows.
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


-- Prevent direct PostgREST comment inserts/updates from bypassing moderation.
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
    -- Do not depend on caller or legacy RPC defaults for identity/moderation.
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
