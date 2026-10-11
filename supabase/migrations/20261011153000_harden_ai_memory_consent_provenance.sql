-- Durable memory is user-controlled: provenance makes model suggestions auditable
-- and the server only writes memories after an explicit remember/save request.
alter table if exists public.ai_memory
  add column if not exists provenance text not null default 'legacy_import'
  check (provenance in ('legacy_import', 'user_confirmed', 'user_edited'));

create index if not exists ai_memory_user_enabled_updated_idx
  on public.ai_memory (user_id, enabled, updated_at desc);

comment on column public.ai_memory.provenance is
  'Origin of the durable memory. Model suggestions are never persisted without explicit user confirmation.';
