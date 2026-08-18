-- HkTube Phase 3: KaliBro AI Intelligence System
create extension if not exists pgcrypto;

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation', module text not null default 'brain', status text not null default 'active',
  context jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, role text not null check (role in ('user','assistant','system','tool')),
  content text not null, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.ai_memory (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  memory_type text not null, memory_key text not null, value jsonb not null, enabled boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, memory_type, memory_key)
);
create table if not exists public.ai_tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete set null, agent text not null, request text not null,
  status text not null default 'queued', permission_level text not null default 'suggest', plan jsonb not null default '[]'::jsonb,
  result jsonb, error_message text, requires_approval boolean not null default false, approved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ai_agents (
  id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users(id) on delete cascade,
  slug text not null unique, display_name text not null, description text not null default '', capabilities jsonb not null default '[]'::jsonb,
  enabled boolean not null default true, config jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ai_workspace_projects (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, description text not null default '', status text not null default 'active', context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ai_workspace_files (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.ai_workspace_projects(id) on delete cascade, name text not null, kind text not null,
  storage_path text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ai_provider_config (
  id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users(id) on delete cascade,
  provider text not null, capability text not null, enabled boolean not null default false, is_fallback boolean not null default false,
  limits jsonb not null default '{}'::jsonb, status text not null default 'unconfigured', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(provider, capability)
);
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null, provider text not null,
  capability text not null, operation text not null, status text not null, units numeric not null default 1, latency_ms integer,
  error_code text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.ai_marketplace_tools (
  id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users(id) on delete cascade, slug text not null unique,
  name text not null, description text not null default '', provider text not null, capabilities jsonb not null default '[]'::jsonb,
  approved boolean not null default false, enabled boolean not null default false, config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ai_permissions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null check (permission in ('read','suggest','execute','admin')), resource text not null default '*',
  granted_by uuid references auth.users(id) on delete set null, expires_at timestamptz, created_at timestamptz not null default now(), unique(user_id, permission, resource)
);

create index if not exists ai_conversations_user_updated_idx on public.ai_conversations(user_id, updated_at desc);
create index if not exists ai_messages_conversation_created_idx on public.ai_messages(conversation_id, created_at);
create index if not exists ai_memory_user_enabled_idx on public.ai_memory(user_id, enabled);
create index if not exists ai_tasks_user_status_idx on public.ai_tasks(user_id, status, updated_at desc);
create index if not exists ai_workspace_files_project_idx on public.ai_workspace_files(project_id, created_at desc);
create index if not exists ai_usage_logs_user_created_idx on public.ai_usage_logs(user_id, created_at desc);
create index if not exists ai_permissions_user_resource_idx on public.ai_permissions(user_id, resource);

create or replace function public.ai_touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
DO $$ declare t text; begin foreach t in array array['ai_conversations','ai_memory','ai_tasks','ai_agents','ai_workspace_projects','ai_workspace_files','ai_provider_config','ai_marketplace_tools'] loop execute format('drop trigger if exists %I_updated_at on public.%I', t, t); execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.ai_touch_updated_at()', t, t); end loop; end $$;

alter table public.ai_conversations enable row level security; alter table public.ai_messages enable row level security; alter table public.ai_memory enable row level security;
alter table public.ai_tasks enable row level security; alter table public.ai_agents enable row level security; alter table public.ai_workspace_projects enable row level security;
alter table public.ai_workspace_files enable row level security; alter table public.ai_provider_config enable row level security; alter table public.ai_usage_logs enable row level security;
alter table public.ai_marketplace_tools enable row level security; alter table public.ai_permissions enable row level security;

create policy ai_conversations_owner on public.ai_conversations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_messages_owner on public.ai_messages for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_memory_owner on public.ai_memory for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_tasks_owner on public.ai_tasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_agents_owner on public.ai_agents for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy ai_workspace_projects_owner on public.ai_workspace_projects for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_workspace_files_owner on public.ai_workspace_files for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_provider_config_owner on public.ai_provider_config for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy ai_usage_logs_owner on public.ai_usage_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_marketplace_tools_owner on public.ai_marketplace_tools for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy ai_permissions_owner on public.ai_permissions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
