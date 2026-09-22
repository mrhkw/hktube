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
