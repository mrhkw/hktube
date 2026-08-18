-- HkTube Phase 1 production schema
create extension if not exists pgcrypto;

create type public.visibility as enum ('public', 'unlisted', 'private');
create type public.moderation_status as enum ('pending', 'approved', 'rejected', 'flagged');
create type public.content_status as enum ('draft', 'processing', 'published', 'failed', 'archived');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  banner_url text,
  bio text,
  website_url text,
  is_creator boolean not null default false,
  is_admin boolean not null default false,
  monetization_status text not null default 'not_eligible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  handle text not null unique,
  name text not null,
  description text,
  avatar_url text,
  banner_url text,
  subscriber_count bigint not null default 0 check (subscriber_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete set null,
  title text not null check (char_length(title) between 1 and 180),
  description text not null default '',
  tags text[] not null default '{}',
  category text,
  language text,
  visibility public.visibility not null default 'private',
  status public.content_status not null default 'draft',
  moderation_status public.moderation_status not null default 'pending',
  video_path text,
  thumbnail_path text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  allow_comments boolean not null default true,
  allow_download boolean not null default false,
  made_for_kids boolean not null default false,
  views bigint not null default 0 check (views >= 0),
  likes_count bigint not null default 0 check (likes_count >= 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shorts (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete set null, title text not null check (char_length(title) between 1 and 180),
  description text not null default '', tags text[] not null default '{}', category text, language text,
  visibility public.visibility not null default 'private', status public.content_status not null default 'draft',
  moderation_status public.moderation_status not null default 'pending', video_path text, thumbnail_path text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0), allow_comments boolean not null default true,
  allow_download boolean not null default false, made_for_kids boolean not null default false, views bigint not null default 0,
  likes_count bigint not null default 0, published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 5000), media_path text, visibility public.visibility not null default 'public',
  status public.content_status not null default 'published', moderation_status public.moderation_status not null default 'approved',
  likes_count bigint not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid references public.videos(id) on delete cascade, short_id uuid references public.shorts(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade, parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000), moderation_status public.moderation_status not null default 'approved',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (num_nonnulls(video_id, short_id, post_id) = 1)
);

create table if not exists public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade, video_id uuid references public.videos(id) on delete cascade,
  short_id uuid references public.shorts(id) on delete cascade, post_id uuid references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (user_id, video_id, short_id, post_id),
  check (num_nonnulls(video_id, short_id, post_id) = 1)
);

create table if not exists public.saves (
  user_id uuid not null references public.profiles(id) on delete cascade, video_id uuid references public.videos(id) on delete cascade,
  short_id uuid references public.shorts(id) on delete cascade, post_id uuid references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (user_id, video_id, short_id, post_id),
  check (num_nonnulls(video_id, short_id, post_id) = 1)
);

create table if not exists public.subscriptions (
  subscriber_id uuid not null references public.profiles(id) on delete cascade, channel_id uuid not null references public.channels(id) on delete cascade, created_at timestamptz not null default now(), primary key (subscriber_id, channel_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null, type text not null, title text not null, body text,
  entity_type text, entity_id uuid, read_at timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.video_views (
  id uuid primary key default gen_random_uuid(), video_id uuid references public.videos(id) on delete cascade, short_id uuid references public.shorts(id) on delete cascade,
  viewer_id uuid references public.profiles(id) on delete set null, session_id text, watch_seconds integer not null default 0, created_at timestamptz not null default now(),
  check (num_nonnulls(video_id, short_id) = 1)
);

create table if not exists public.watch_history (
  user_id uuid not null references public.profiles(id) on delete cascade, video_id uuid references public.videos(id) on delete cascade,
  short_id uuid references public.shorts(id) on delete cascade, progress_seconds integer not null default 0, watched_at timestamptz not null default now(),
  primary key (user_id, video_id, short_id), check (num_nonnulls(video_id, short_id) = 1)
);

create table if not exists public.creator_analytics (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.profiles(id) on delete cascade,
  content_type text, content_id uuid, day date not null default current_date, views bigint not null default 0, watch_seconds bigint not null default 0,
  likes bigint not null default 0, comments bigint not null default 0, subscribers_gained bigint not null default 0, created_at timestamptz not null default now(),
  unique (creator_id, content_type, content_id, day)
);

create table if not exists public.upload_jobs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  content_type text not null check (content_type in ('video', 'short', 'post')), content_id uuid, file_name text not null, storage_path text,
  bytes_total bigint not null default 0, bytes_uploaded bigint not null default 0, status text not null default 'pending', error_message text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid references public.videos(id) on delete cascade, short_id uuid references public.shorts(id) on delete cascade, post_id uuid references public.posts(id) on delete cascade,
  reason text not null, details text, status text not null default 'open', created_at timestamptz not null default now(), resolved_at timestamptz,
  check (num_nonnulls(video_id, short_id, post_id) = 1)
);

create table if not exists public.creator_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade, default_visibility public.visibility not null default 'private',
  allow_downloads boolean not null default false, default_comments boolean not null default true, default_language text, updated_at timestamptz not null default now()
);

create index if not exists videos_public_feed_idx on public.videos (visibility, status, moderation_status, published_at desc);
create index if not exists videos_creator_idx on public.videos (creator_id, created_at desc);
create index if not exists videos_search_idx on public.videos using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'')));
create index if not exists shorts_feed_idx on public.shorts (visibility, status, published_at desc);
create index if not exists posts_feed_idx on public.posts (visibility, status, created_at desc);
create index if not exists notifications_user_idx on public.notifications (user_id, read_at, created_at desc);
create index if not exists upload_jobs_user_idx on public.upload_jobs (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.channels enable row level security;
alter table public.videos enable row level security;
alter table public.shorts enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.saves enable row level security;
alter table public.subscriptions enable row level security;
alter table public.notifications enable row level security;
alter table public.video_views enable row level security;
alter table public.watch_history enable row level security;
alter table public.creator_analytics enable row level security;
alter table public.upload_jobs enable row level security;
alter table public.reports enable row level security;
alter table public.creator_settings enable row level security;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.profiles where id = auth.uid() and is_admin); $$;
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

do $$ declare t text; begin foreach t in array array['profiles','channels','videos','shorts','posts','comments','upload_jobs','creator_settings'] loop execute format('drop policy if exists owner_select on public.%I', t); execute format('drop policy if exists owner_insert on public.%I', t); execute format('drop policy if exists owner_update on public.%I', t); execute format('drop policy if exists owner_delete on public.%I', t); end loop; end $$;

create policy profile_public_read on public.profiles for select using (true); create policy profile_owner_write on public.profiles for all using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy channel_public_read on public.channels for select using (true); create policy channel_owner_write on public.channels for all using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy content_public_read on public.videos for select using ((visibility = 'public' and status = 'published' and moderation_status = 'approved') or creator_id = auth.uid() or public.is_admin()); create policy content_owner_write on public.videos for all using (creator_id = auth.uid() or public.is_admin()) with check (creator_id = auth.uid() or public.is_admin());
create policy shorts_public_read on public.shorts for select using ((visibility = 'public' and status = 'published' and moderation_status = 'approved') or creator_id = auth.uid() or public.is_admin()); create policy shorts_owner_write on public.shorts for all using (creator_id = auth.uid() or public.is_admin()) with check (creator_id = auth.uid() or public.is_admin());
create policy posts_public_read on public.posts for select using ((visibility = 'public' and status = 'published') or creator_id = auth.uid() or public.is_admin()); create policy posts_owner_write on public.posts for all using (creator_id = auth.uid() or public.is_admin()) with check (creator_id = auth.uid() or public.is_admin());
create policy comments_read on public.comments for select using (true); create policy comments_write on public.comments for insert with check (author_id = auth.uid()); create policy comments_manage on public.comments for update using (author_id = auth.uid() or public.is_admin()) with check (author_id = auth.uid() or public.is_admin());
create policy likes_read on public.likes for select using (true); create policy likes_write on public.likes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saves_owner on public.saves for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy subscriptions_read on public.subscriptions for select using (true); create policy subscriptions_owner on public.subscriptions for all using (subscriber_id = auth.uid()) with check (subscriber_id = auth.uid());
create policy notifications_owner on public.notifications for select using (user_id = auth.uid()); create policy notifications_mark on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy views_insert on public.video_views for insert with check (viewer_id = auth.uid() or viewer_id is null); create policy views_owner_read on public.video_views for select using (viewer_id = auth.uid() or public.is_admin());
create policy history_owner on public.watch_history for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy analytics_owner on public.creator_analytics for select using (creator_id = auth.uid() or public.is_admin());
create policy upload_owner on public.upload_jobs for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy reports_owner on public.reports for insert with check (reporter_id = auth.uid()); create policy reports_read on public.reports for select using (reporter_id = auth.uid() or public.is_admin());
create policy settings_owner on public.creator_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$ declare t text; begin foreach t in array array['profiles','channels','videos','shorts','posts','comments','upload_jobs','creator_settings'] loop execute format('drop trigger if exists set_updated_at on public.%I', t); execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t); end loop; end $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.profiles(id, display_name) values(new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1))) on conflict (id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
