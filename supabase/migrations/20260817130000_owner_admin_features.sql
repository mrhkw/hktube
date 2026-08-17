-- HkTube owner verification, moderation, and username integrity.
-- Run this migration in the Supabase SQL Editor after the video upload migration.

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.profiles add column if not exists is_official boolean not null default false;
alter table public.profiles add column if not exists is_banned boolean not null default false;
alter table public.profiles add column if not exists ban_reason text;

update public.profiles
set username = lower(regexp_replace(coalesce(nullif(channel_name, ''), 'user_' || left(id::text, 8)), '[^a-zA-Z0-9_]+', '_', 'g'))
where username is null or btrim(username) = '';

-- Resolve any legacy duplicates deterministically before enforcing uniqueness.
with duplicates as (
  select id, username, row_number() over (partition by username order by created_at, id) as ordinal
  from public.profiles
  where username is not null
)
update public.profiles p
set username = d.username || '_' || d.ordinal
from duplicates d
where p.id = d.id and d.ordinal > 1;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'moderator', 'admin', 'super_admin', 'owner'));
create unique index if not exists profiles_username_unique_idx on public.profiles (lower(username)) where username is not null;
create index if not exists profiles_role_idx on public.profiles (role, is_banned);

-- The owner account is identified by the authenticated email in the API layer.
-- The API layer can set these flags after this migration has been applied.
