-- HkTube copyright fingerprinting and private support records.
-- Review and run this migration in Supabase SQL Editor before enabling production enforcement.

alter table public.signals add column if not exists content_hash text;
alter table public.signals add column if not exists is_ai_generated boolean not null default false;
alter table public.signals add column if not exists copyright_status text not null default 'clear';
alter table public.signals add column if not exists unlisted boolean not null default false;
alter table public.signals add column if not exists dispute_status text;
alter table public.signals add column if not exists dispute_notes text;

create index if not exists signals_content_hash_idx on public.signals(content_hash) where content_hash is not null;
create index if not exists signals_copyright_status_idx on public.signals(copyright_status);

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  topic text not null default 'support',
  reply_email text not null,
  message text not null,
  destination_email text,
  status text not null default 'received',
  created_at timestamptz not null default now()
);

alter table public.support_requests enable row level security;
drop policy if exists support_requests_no_public_select on public.support_requests;
create policy support_requests_no_public_select on public.support_requests for select using (false);
