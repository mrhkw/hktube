-- HkTube enterprise security hardening for the Supabase-backed surface.
-- Execute in Supabase SQL Editor with a role allowed to alter public tables.
-- All statements are idempotent and deliberately use auth.uid() ownership checks.

alter table if exists public.profiles enable row level security;
alter table if exists public.videos enable row level security;
alter table if exists public.comments enable row level security;
alter table if exists public.likes enable row level security;
alter table if exists public.video_likes enable row level security;

-- Remove legacy policies with permissive or ambiguous names before recreating the
-- explicit policy set. Missing tables are handled by the guarded DO blocks below.
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
    execute 'create policy "hktube_videos_public_read" on public.videos for select to anon, authenticated using ((visibility = ''public'' and status = ''published'') or creator_id = auth.uid())';
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
