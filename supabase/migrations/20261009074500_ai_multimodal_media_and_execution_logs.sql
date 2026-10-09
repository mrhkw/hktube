-- Multimodal HkTube AI: private media and execution observability.
-- Existing ai_conversations/ai_messages remain the canonical session/message store.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-media',
  'user-media',
  false,
  104857600,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "user media: owner can upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'user-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "user media: owner can read"
on storage.objects for select to authenticated
using (
  bucket_id = 'user-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "user media: owner can update"
on storage.objects for update to authenticated
using (
  bucket_id = 'user-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'user-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "user media: owner can delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'user-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create table if not exists public.ai_agent_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  step text not null check (char_length(step) between 1 and 80),
  status text not null check (status in ('started','active','complete','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_agent_logs_user_created_idx
  on public.ai_agent_logs(user_id, created_at desc);

alter table public.ai_agent_logs enable row level security;

create policy "ai agent logs: owner read"
on public.ai_agent_logs for select to authenticated
using (user_id = (select auth.uid()));

create policy "ai agent logs: owner insert"
on public.ai_agent_logs for insert to authenticated
with check (user_id = (select auth.uid()));

revoke update, delete on public.ai_agent_logs from anon, authenticated;
grant select, insert on public.ai_agent_logs to authenticated;
