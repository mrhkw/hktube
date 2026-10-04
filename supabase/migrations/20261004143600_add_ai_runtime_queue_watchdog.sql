create index if not exists ai_runtime_tasks_watchdog_idx on public.ai_runtime_tasks (status, available_at, lease_until, priority);

create or replace function public.watchdog_ai_runtime_tasks()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  requeued_count integer := 0;
  failed_count integer := 0;
begin
  with recovered as (
    update public.ai_runtime_tasks
       set status = case when attempt_count + 1 >= max_attempts then 'FAILED' else 'QUEUED' end,
           attempt_count = attempt_count + 1,
           available_at = case when attempt_count + 1 >= max_attempts then available_at else now() + make_interval(mins => least(15, greatest(1, (attempt_count + 1) * 2))) end,
           lease_until = null,
           lock_token = null,
           error_code = 'LEASE_EXPIRED',
           error_message = 'Worker lease expired; task was recovered by the queue watchdog.',
           updated_at = now(),
           completed_at = case when attempt_count + 1 >= max_attempts then now() else null end
     where status = 'PROCESSING'
       and lease_until is not null
       and lease_until < now()
     returning task_id, team_id, agent_id, action, actor_id, attempt_count, status, error_code, error_message, request_id
  )
  insert into public.ai_runtime_audit(actor_type, actor_id, team_id, agent_id, task_id, action, resource, result, error_code, error_message, request_id, after_state)
  select 'system', actor_id, team_id, agent_id, task_id, 'task.lease_watchdog', 'ai_runtime_tasks',
         case when status = 'FAILED' then 'FAIL' else 'REQUEUE' end,
         error_code, error_message, request_id,
         jsonb_build_object('status', status, 'attempt_count', attempt_count)
    from recovered;

  select count(*) filter (where status = 'QUEUED'), count(*) filter (where status = 'FAILED')
    into requeued_count, failed_count
    from public.ai_runtime_tasks
   where error_code = 'LEASE_EXPIRED'
     and updated_at >= now() - interval '1 minute';

  return jsonb_build_object('requeued', requeued_count, 'failed', failed_count, 'checked_at', now());
end
$function$;

revoke execute on function public.watchdog_ai_runtime_tasks() from public, anon, authenticated;
grant execute on function public.watchdog_ai_runtime_tasks() to service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hktube-ai-runtime-watchdog') THEN
    PERFORM cron.schedule('hktube-ai-runtime-watchdog', '*/5 * * * *', 'select public.watchdog_ai_runtime_tasks();');
  END IF;
END $$;
