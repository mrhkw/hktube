create index if not exists scheduled_publications_worker_claim_idx on public.scheduled_publications (status, scheduled_for, locked_at);

create or replace function public.process_scheduled_publications()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  processed_count integer := 0;
begin
  update public.scheduled_publications
     set status = 'scheduled', locked_at = null, last_error = 'Recovered stale worker lock.'
   where status = 'processing'
     and locked_at < now() - interval '10 minutes'
     and attempts < 5;

  with claimable as (
    select id
      from public.scheduled_publications
     where status = 'scheduled'
       and scheduled_for <= now()
       and locked_at is null
       and (video_id is not null or post_id is not null)
     order by scheduled_for, created_at
     for update skip locked
     limit 100
  )
  update public.scheduled_publications sp
     set status = 'processing', locked_at = now(), attempts = attempts + 1, last_error = null
    from claimable c
   where sp.id = c.id;

  update public.videos v
     set status = 'published', published_at = coalesce(v.published_at, now()), updated_at = now()
   where v.id in (
     select sp.video_id from public.scheduled_publications sp
      where sp.status = 'processing' and sp.video_id is not null and sp.locked_at > now() - interval '10 minutes'
   )
     and v.status in ('draft', 'processing', 'ready')
     and v.moderation_status = 'approved'
     and v.deleted_at is null;

  update public.posts p
     set status = 'published', visibility = 'public', updated_at = now()
   where p.id in (
     select sp.post_id from public.scheduled_publications sp
      where sp.status = 'processing' and sp.post_id is not null and sp.locked_at > now() - interval '10 minutes'
   )
     and p.moderation_status = 'approved';

  update public.scheduled_publications sp
     set status = case
       when sp.video_id is not null and exists (select 1 from public.videos v where v.id = sp.video_id and v.status = 'published') then 'published'
       when sp.post_id is not null and exists (select 1 from public.posts p where p.id = sp.post_id and p.status = 'published') then 'published'
       else 'failed'
     end,
     processed_at = now(), locked_at = null,
     last_error = case
       when sp.video_id is not null and not exists (select 1 from public.videos v where v.id = sp.video_id and v.status = 'published') then 'Video is not moderation-approved, ready, or available.'
       when sp.post_id is not null and not exists (select 1 from public.posts p where p.id = sp.post_id and p.status = 'published') then 'Post is not moderation-approved or available.'
       else null
     end
   where sp.status = 'processing' and sp.locked_at > now() - interval '10 minutes';

  get diagnostics processed_count = row_count;
  return processed_count;
end
$function$;

revoke execute on function public.process_scheduled_publications() from public, anon, authenticated;
grant execute on function public.process_scheduled_publications() to service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hktube-scheduled-publications') THEN
    PERFORM cron.schedule('hktube-scheduled-publications', '* * * * *', 'select public.process_scheduled_publications();');
  END IF;
END $$;
