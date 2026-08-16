-- HkTube core schema and row-level security.
-- Run this migration in the Supabase SQL editor or through the Supabase CLI.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  channel_name text,
  category text,
  description text,
  avatar_url text,
  banner_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  video_url text not null,
  thumbnail_url text,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  category text,
  views bigint not null default 0 check (views >= 0),
  likes bigint not null default 0 check (likes >= 0),
  allow_downloads boolean not null default false,
  visibility text not null default 'public' check (visibility in ('public', 'followers', 'private')),
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.signals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.signals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (video_id, user_id)
);

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.watch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.signals(id) on delete cascade,
  watched_at timestamptz not null default now(),
  unique (user_id, video_id)
);

create table if not exists public.watch_later (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.signals(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, video_id)
);

create index if not exists signals_public_created_idx on public.signals (visibility, created_at desc);
create index if not exists signals_creator_idx on public.signals (creator_id, created_at desc);
create index if not exists comments_video_idx on public.comments (video_id, created_at desc);
create index if not exists likes_video_idx on public.likes (video_id);
create index if not exists follows_following_idx on public.follows (following_id);
create index if not exists history_user_idx on public.watch_history (user_id, watched_at desc);
create index if not exists watch_later_user_idx on public.watch_later (user_id, created_at desc);

-- Enable RLS on every application table.
alter table public.profiles enable row level security;
alter table public.signals enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.follows enable row level security;
alter table public.watch_history enable row level security;
alter table public.watch_later enable row level security;

-- Policies are dropped first so this migration can be safely re-run.
do $$ declare policy_record record; begin
  for policy_record in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('profiles','signals','comments','likes','follows','watch_history','watch_later') loop
    execute format('drop policy if exists %I on %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename);
  end loop;
end $$;

create policy profiles_select_authenticated on public.profiles for select to authenticated using (true);
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_delete_own on public.profiles for delete to authenticated using (id = auth.uid());

create policy signals_select_public_authenticated on public.signals for select to authenticated using (visibility = 'public' or creator_id = auth.uid());
create policy signals_insert_own on public.signals for insert to authenticated with check (creator_id = auth.uid());
create policy signals_update_own on public.signals for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy signals_delete_own on public.signals for delete to authenticated using (creator_id = auth.uid());

create policy comments_select_public_authenticated on public.comments for select to authenticated using (exists (select 1 from public.signals s where s.id = video_id and (s.visibility = 'public' or s.creator_id = auth.uid())));
create policy comments_insert_own on public.comments for insert to authenticated with check (user_id = auth.uid());
create policy comments_update_own on public.comments for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy comments_delete_own on public.comments for delete to authenticated using (user_id = auth.uid());

create policy likes_select_authenticated on public.likes for select to authenticated using (true);
create policy likes_insert_own on public.likes for insert to authenticated with check (user_id = auth.uid());
create policy likes_update_own on public.likes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy likes_delete_own on public.likes for delete to authenticated using (user_id = auth.uid());

create policy follows_select_authenticated on public.follows for select to authenticated using (true);
create policy follows_insert_own on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy follows_update_own on public.follows for update to authenticated using (follower_id = auth.uid()) with check (follower_id = auth.uid());
create policy follows_delete_own on public.follows for delete to authenticated using (follower_id = auth.uid());

create policy history_select_own on public.watch_history for select to authenticated using (user_id = auth.uid());
create policy history_insert_own on public.watch_history for insert to authenticated with check (user_id = auth.uid());
create policy history_update_own on public.watch_history for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy history_delete_own on public.watch_history for delete to authenticated using (user_id = auth.uid());

create policy watch_later_select_own on public.watch_later for select to authenticated using (user_id = auth.uid());
create policy watch_later_insert_own on public.watch_later for insert to authenticated with check (user_id = auth.uid());
create policy watch_later_update_own on public.watch_later for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy watch_later_delete_own on public.watch_later for delete to authenticated using (user_id = auth.uid());

-- New auth users receive a profile row, while preserving the ability to edit it later.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
