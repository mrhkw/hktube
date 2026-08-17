-- Corrective migration for projects where the original base migration was never applied.
-- Safe to run repeatedly and compatible with the existing incremental migrations.

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

alter table public.signals add column if not exists video_type text not null default 'video';
alter table public.signals add column if not exists tags text[] not null default '{}';
alter table public.signals add column if not exists language text;
alter table public.signals add column if not exists allow_comments boolean not null default true;
alter table public.signals add column if not exists duration_seconds integer;

-- Normalize legacy rows before enforcing the type constraint.
update public.signals set video_type = 'video' where video_type is null or video_type not in ('video', 'short');
alter table public.signals drop constraint if exists signals_video_type_check;
alter table public.signals add constraint signals_video_type_check check (video_type in ('video', 'short'));

create index if not exists signals_public_created_idx on public.signals (visibility, created_at desc);
create index if not exists signals_creator_idx on public.signals (creator_id, created_at desc);
create index if not exists signals_type_idx on public.signals (video_type, visibility, created_at desc);

alter table public.profiles enable row level security;
alter table public.signals enable row level security;

drop policy if exists signals_select_public_authenticated on public.signals;
drop policy if exists signals_select_guest_public on public.signals;
drop policy if exists signals_insert_own on public.signals;
drop policy if exists signals_update_own on public.signals;
drop policy if exists signals_delete_own on public.signals;

create policy signals_select_public_authenticated
  on public.signals for select to authenticated
  using (visibility = 'public' or creator_id = auth.uid());
create policy signals_select_guest_public
  on public.signals for select to anon
  using (visibility = 'public');
create policy signals_insert_own
  on public.signals for insert to authenticated
  with check (creator_id = auth.uid());
create policy signals_update_own
  on public.signals for update to authenticated
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy signals_delete_own
  on public.signals for delete to authenticated
  using (creator_id = auth.uid());
