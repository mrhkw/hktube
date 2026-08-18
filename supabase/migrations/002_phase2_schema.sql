-- HkTube Phase 2 production schema: additive, configurable, and RLS protected.
create extension if not exists pgcrypto;

alter table public.profiles add column if not exists is_premium boolean not null default false;
alter table public.profiles add column if not exists is_monetized boolean not null default false;
alter table public.profiles add column if not exists monetization_status text not null default 'not_eligible';
alter table public.profiles add column if not exists total_watch_time_seconds bigint not null default 0;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','super_admin','owner') and coalesce(p.is_banned,false) = false);
$$;

create table if not exists public.premium_subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'monthly' check (plan in ('monthly','annual')), status text not null default 'pending' check (status in ('pending','active','expired','cancelled')),
  provider text, provider_transaction_id text unique, started_at timestamptz, expires_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.monetization_applications (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null references auth.users(id) on delete cascade,
  subscribers_at_application bigint not null default 0, watch_time_seconds_at_application bigint not null default 0,
  status text not null default 'submitted' check (status in ('submitted','under_review','approved','rejected','withdrawn')),
  checks jsonb not null default '{}'::jsonb, reviewer_id uuid references auth.users(id), reviewer_notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.creator_wallets (
  id uuid primary key default gen_random_uuid(), creator_id uuid unique not null references auth.users(id) on delete cascade,
  available_balance numeric(14,2) not null default 0 check (available_balance >= 0), pending_balance numeric(14,2) not null default 0 check (pending_balance >= 0), currency text not null default 'PKR', updated_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid references public.creator_wallets(id) on delete set null, amount numeric(14,2) not null check (amount > 0), method text not null check (method in ('jazzcash','easypaisa','bank_transfer','card_provider')),
  payout_details jsonb not null default '{}'::jsonb, status text not null default 'pending' check (status in ('pending','processing','paid','rejected','cancelled')),
  verification_status text not null default 'required' check (verification_status in ('required','verified','failed')), reviewed_by uuid references auth.users(id), reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null, provider text not null, provider_transaction_id text not null unique,
  amount numeric(14,2) not null, currency text not null default 'PKR', purpose text not null default 'premium', status text not null default 'received' check (status in ('received','verified','failed','refunded')),
  raw_payload jsonb not null default '{}'::jsonb, verified_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null references auth.users(id) on delete cascade, video_id uuid references public.signals(id) on delete set null,
  objective text not null check (objective in ('views','reach','engagement','profile_visits')), budget numeric(14,2) not null check (budget > 0), currency text not null default 'PKR', status text not null default 'pending_payment' check (status in ('pending_payment','pending_review','active','paused','completed','rejected')),
  payment_transaction_id uuid references public.payment_transactions(id) on delete set null, starts_at timestamptz, ends_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ad_slots (
  id uuid primary key default gen_random_uuid(), placement text not null check (placement in ('in_feed','video','banner')), enabled boolean not null default false, provider text, configuration jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null references auth.users(id) on delete cascade, title text not null, description text, thumbnail_url text, category text, privacy text not null default 'public' check (privacy in ('public','followers','private')), status text not null default 'scheduled' check (status in ('scheduled','live','ended','cancelled')), provider text, provider_stream_id text, viewer_count integer not null default 0, started_at timestamptz, ended_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.live_chat (
  id uuid primary key default gen_random_uuid(), stream_id uuid not null references public.live_streams(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, message text not null check (char_length(message) between 1 and 500), is_deleted boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id) on delete set null, event_type text not null, action text not null, target_type text, target_id text, metadata jsonb not null default '{}'::jsonb, ip_hash text, created_at timestamptz not null default now()
);
create table if not exists public.ai_command_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid not null references auth.users(id) on delete cascade, command text not null, status text not null default 'analyzed' check (status in ('analyzed','previewed','awaiting_approval','executed','tested','failed','rejected')), analysis jsonb not null default '{}'::jsonb, result jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), completed_at timestamptz
);
create table if not exists public.emergency_locks (
  id uuid primary key default gen_random_uuid(), key text unique not null, enabled boolean not null default false, reason text, enabled_by uuid references auth.users(id) on delete set null, updated_at timestamptz not null default now()
);
create table if not exists public.admin_settings (
  id uuid primary key default gen_random_uuid(), key text unique not null, value jsonb not null default '{}'::jsonb, updated_by uuid references auth.users(id) on delete set null, updated_at timestamptz not null default now()
);
insert into public.admin_settings(key, value) values ('monetization_thresholds', '{"subscribers":200,"watch_hours":500}'::jsonb) on conflict (key) do nothing;

create index if not exists premium_subscriptions_user_status_idx on public.premium_subscriptions(user_id,status,expires_at);
create index if not exists monetization_applications_creator_status_idx on public.monetization_applications(creator_id,status);
create index if not exists withdrawal_requests_creator_status_idx on public.withdrawal_requests(creator_id,status);
create index if not exists payment_transactions_provider_idx on public.payment_transactions(provider,provider_transaction_id);
create index if not exists ad_campaigns_creator_status_idx on public.ad_campaigns(creator_id,status);
create index if not exists live_streams_status_created_idx on public.live_streams(status,created_at desc);
create index if not exists live_chat_stream_created_idx on public.live_chat(stream_id,created_at);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);
create index if not exists ai_command_logs_actor_created_idx on public.ai_command_logs(actor_id,created_at desc);

alter table public.premium_subscriptions enable row level security;
alter table public.monetization_applications enable row level security;
alter table public.creator_wallets enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_slots enable row level security;
alter table public.live_streams enable row level security;
alter table public.live_chat enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.ai_command_logs enable row level security;
alter table public.emergency_locks enable row level security;
alter table public.admin_settings enable row level security;

drop policy if exists premium_select_owner on public.premium_subscriptions;
create policy premium_select_owner on public.premium_subscriptions for select to authenticated using (public.is_admin() or user_id = auth.uid());
drop policy if exists monetization_select_owner on public.monetization_applications;
create policy monetization_select_owner on public.monetization_applications for select to authenticated using (public.is_admin() or creator_id = auth.uid());
drop policy if exists wallet_select_owner on public.creator_wallets;
create policy wallet_select_owner on public.creator_wallets for select to authenticated using (public.is_admin() or creator_id = auth.uid());
drop policy if exists withdrawal_select_owner on public.withdrawal_requests;
create policy withdrawal_select_owner on public.withdrawal_requests for select to authenticated using (public.is_admin() or creator_id = auth.uid());
drop policy if exists payment_select_owner on public.payment_transactions;
create policy payment_select_owner on public.payment_transactions for select to authenticated using (public.is_admin() or user_id = auth.uid());
drop policy if exists campaign_select_owner on public.ad_campaigns;
create policy campaign_select_owner on public.ad_campaigns for select to authenticated using (public.is_admin() or creator_id = auth.uid());
drop policy if exists ad_slot_select_authenticated on public.ad_slots;
create policy ad_slot_select_authenticated on public.ad_slots for select to authenticated using (enabled = true or public.is_admin());
drop policy if exists live_select_owner on public.live_streams;
create policy live_select_owner on public.live_streams for select to authenticated using (public.is_admin() or creator_id = auth.uid() or privacy = 'public');
drop policy if exists chat_select_authenticated on public.live_chat;
create policy chat_select_authenticated on public.live_chat for select to authenticated using (public.is_admin() or user_id = auth.uid() or exists (select 1 from public.live_streams s where s.id = stream_id and s.privacy = 'public'));
drop policy if exists audit_select_admin on public.admin_audit_logs;
create policy audit_select_admin on public.admin_audit_logs for select to authenticated using (public.is_admin());
drop policy if exists ai_select_owner on public.ai_command_logs;
create policy ai_select_owner on public.ai_command_logs for select to authenticated using (public.is_admin() or actor_id = auth.uid());
drop policy if exists lock_select_admin on public.emergency_locks;
create policy lock_select_admin on public.emergency_locks for select to authenticated using (public.is_admin());
drop policy if exists settings_select_authenticated on public.admin_settings;
create policy settings_select_authenticated on public.admin_settings for select to authenticated using (true);

drop policy if exists "wallet_update_owner" on public.creator_wallets;
create policy "wallet_update_owner" on public.creator_wallets for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "withdraw_insert_owner" on public.withdrawal_requests;
create policy "withdraw_insert_owner" on public.withdrawal_requests for insert to authenticated with check (creator_id = auth.uid());
drop policy if exists "chat_insert_member" on public.live_chat;
create policy "chat_insert_member" on public.live_chat for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "campaign_insert_owner" on public.ad_campaigns;
create policy "campaign_insert_owner" on public.ad_campaigns for insert to authenticated with check (creator_id = auth.uid());
drop policy if exists "live_insert_owner" on public.live_streams;
create policy "live_insert_owner" on public.live_streams for insert to authenticated with check (creator_id = auth.uid());
drop policy if exists monetization_insert_owner on public.monetization_applications;
create policy monetization_insert_owner on public.monetization_applications for insert to authenticated with check (creator_id = auth.uid());
drop policy if exists ai_insert_owner on public.ai_command_logs;
create policy ai_insert_owner on public.ai_command_logs for insert to authenticated with check (actor_id = auth.uid() and public.is_admin());
drop policy if exists ai_update_owner on public.ai_command_logs;
create policy ai_update_owner on public.ai_command_logs for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists lock_insert_admin on public.emergency_locks;
create policy lock_insert_admin on public.emergency_locks for insert to authenticated with check (public.is_admin());
drop policy if exists lock_update_admin on public.emergency_locks;
create policy lock_update_admin on public.emergency_locks for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists settings_update_admin on public.admin_settings;
create policy settings_update_admin on public.admin_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists live_update_owner on public.live_streams;
create policy live_update_owner on public.live_streams for update to authenticated using (public.is_admin() or creator_id = auth.uid()) with check (public.is_admin() or creator_id = auth.uid());
