-- Community post extras for the "+ → Post" composer.
--
-- Adds everything the YouTube-style composer can use but the original posts
-- table did not have: a multi-image list (up to ten images), scheduling, expiry
-- and an explicit publish time, plus the privacy flag behind "Keep all my
-- subscriptions private" on the Edit channel page.
--
-- Idempotent, so it is safe to run more than once.

alter table if exists public.posts
  add column if not exists media_paths jsonb not null default '[]'::jsonb,
  add column if not exists scheduled_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists published_at timestamptz default now();

comment on column public.posts.media_paths is
  'Storage paths in the thumbnails bucket, in carousel order. Falls back to the single media_path when empty.';
comment on column public.posts.scheduled_at is
  'Set for scheduled posts. The client maintenance sweep publishes them once due, because posts have no server worker yet.';
comment on column public.posts.expires_at is
  'Optional expiry. The client maintenance sweep switches expired posts to private.';

create index if not exists posts_due_idx
  on public.posts (scheduled_at)
  where status = 'scheduled';

create index if not exists posts_expiry_idx
  on public.posts (expires_at)
  where status = 'published';

alter table if exists public.profiles
  add column if not exists subscriptions_private boolean not null default false;

comment on column public.profiles.subscriptions_private is
  'Edit channel → privacy. Keeps the account''s subscription list off any public surface.';

alter table if exists public.posts enable row level security;

drop policy if exists "hktube_public_read_published_posts" on public.posts;
create policy "hktube_public_read_published_posts"
on public.posts for select
to anon, authenticated
using (
  (
    visibility = 'public'
    and status = 'published'
    and coalesce(moderation_status, 'approved') = 'approved'
  )
  or author_id = auth.uid()
);

drop policy if exists "hktube_author_insert_posts" on public.posts;
create policy "hktube_author_insert_posts"
on public.posts for insert
to authenticated
with check (author_id = auth.uid());

drop policy if exists "hktube_author_update_posts" on public.posts;
create policy "hktube_author_update_posts"
on public.posts for update
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

drop policy if exists "hktube_author_delete_posts" on public.posts;
create policy "hktube_author_delete_posts"
on public.posts for delete
to authenticated
using (author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Add details extras for uploaded videos.
-- ---------------------------------------------------------------------------

alter table if exists public.videos
  add column if not exists location text,
  add column if not exists ai_generated boolean not null default false,
  add column if not exists age_restricted boolean not null default false,
  add column if not exists paid_promotion boolean not null default false,
  add column if not exists brand_name text,
  add column if not exists remix_policy text not null default 'video_and_audio';

comment on column public.videos.ai_generated is
  'Attributes → AI use. When true the watch page shows an altered or synthetic content label.';
comment on column public.videos.remix_policy is
  'Community → Shorts remixing: video_and_audio, audio_only or none.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'videos_remix_policy_check'
  ) then
    alter table public.videos
      add constraint videos_remix_policy_check
      check (remix_policy in ('video_and_audio', 'audio_only', 'none'));
  end if;
end $$;
