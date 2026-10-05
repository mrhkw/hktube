create table if not exists public.video_transcripts (video_id uuid primary key references public.videos(id) on delete cascade, transcript text not null default '', provider text not null, provider_version text not null, status text not null check (status in ('queued','processing','completed','failed')), updated_at timestamptz not null default now());
alter table public.video_transcripts enable row level security;
revoke all on public.video_transcripts from anon, authenticated;
grant all on public.video_transcripts to service_role;
drop policy if exists hktube_transcripts_service_only on public.video_transcripts;
create policy hktube_transcripts_service_only on public.video_transcripts for all to service_role using (true) with check (true);
