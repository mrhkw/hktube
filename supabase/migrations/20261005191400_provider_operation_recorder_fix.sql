create or replace function public.record_provider_operation(p_provider_key text, p_operation text, p_success boolean, p_latency_ms integer default null, p_error_class text default null, p_correlation_id text default null, p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_failures integer; v_state text; v_circuit text;
begin
  insert into public.provider_operations(provider_key, operation, correlation_id, success, latency_ms, error_class, metadata)
  values (left(p_provider_key,80), left(p_operation,160), left(p_correlation_id,120), p_success, p_latency_ms, left(p_error_class,80), coalesce(p_metadata,'{}'::jsonb));
  insert into public.provider_health(provider_key, state, circuit_state, last_checked_at, last_success_at, last_failure_at, last_latency_ms, success_count, failure_count, consecutive_failures, last_error, metadata)
  values (left(p_provider_key,80), case when p_success then 'HEALTHY' else 'DEGRADED' end, 'CLOSED', now(), case when p_success then now() else null end, case when not p_success then now() else null end, p_latency_ms, case when p_success then 1 else 0 end, case when not p_success then 1 else 0 end, case when p_success then 0 else 1 end, left(p_error_class,500), coalesce(p_metadata,'{}'::jsonb))
  on conflict (provider_key) do update set
    state = case when p_success then 'HEALTHY' when provider_health.consecutive_failures + 1 >= 10 then 'OFFLINE' when provider_health.consecutive_failures + 1 >= 5 then 'FAILING' else 'DEGRADED' end,
    circuit_state = case when not p_success and provider_health.consecutive_failures + 1 >= 5 then 'OPEN' when p_success then 'CLOSED' else provider_health.circuit_state end,
    last_checked_at = now(), last_success_at = case when p_success then now() else provider_health.last_success_at end, last_failure_at = case when not p_success then now() else provider_health.last_failure_at end, last_latency_ms = p_latency_ms,
    success_count = provider_health.success_count + case when p_success then 1 else 0 end, failure_count = provider_health.failure_count + case when not p_success then 1 else 0 end,
    consecutive_failures = case when p_success then 0 else provider_health.consecutive_failures + 1 end, last_error = case when p_success then null else left(p_error_class,500) end, metadata = coalesce(p_metadata,'{}'::jsonb)
  returning provider_health.consecutive_failures, provider_health.state, provider_health.circuit_state into v_failures, v_state, v_circuit;
  insert into public.autonomous_metrics(metric_key, bucket_start, metric_value, metadata)
  values (left('provider.' || p_provider_key || case when p_success then '.success' else '.failure' end,120), date_trunc('minute', now()), 1, jsonb_build_object('operation',p_operation))
  on conflict (metric_key,bucket_start) do update set metric_value = autonomous_metrics.metric_value + 1;
  return jsonb_build_object('provider_key',p_provider_key,'state',v_state,'circuit_state',v_circuit,'consecutive_failures',v_failures);
end;
$$;
revoke execute on function public.record_provider_operation(text,text,boolean,integer,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.record_provider_operation(text,text,boolean,integer,text,text,jsonb) to service_role;
