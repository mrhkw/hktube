create table if not exists public.creator_warnings (id uuid primary key default gen_random_uuid(), creator_id uuid not null, channel_id uuid references public.channels(id) on delete set null, video_id uuid references public.videos(id) on delete set null, severity text not null check (severity in ('warning','serious','critical')), reason_code text not null, reason text not null, status text not null default 'open' check (status in ('open','acknowledged','appealed','resolved')), created_at timestamptz not null default now(), resolved_at timestamptz, metadata jsonb not null default '{}'::jsonb);
create index if not exists creator_warnings_creator_created_idx on public.creator_warnings(creator_id, created_at desc);
create index if not exists creator_warnings_video_idx on public.creator_warnings(video_id, created_at desc);
alter table public.creator_warnings enable row level security;
revoke all on public.creator_warnings from anon, authenticated;
grant all on public.creator_warnings to service_role;
create or replace function public.hktube_decide_safety_policy(p_signals jsonb)
returns jsonb language plpgsql immutable security definer set search_path = pg_catalog, public
as $function$
declare sexual numeric := greatest(coalesce((p_signals->>'sexual_confidence')::numeric,0), coalesce((p_signals->>'adult_confidence')::numeric,0), coalesce((p_signals->>'nudity_confidence')::numeric,0)); graphic numeric := greatest(coalesce((p_signals->>'graphic_confidence')::numeric,0), coalesce((p_signals->>'violence_confidence')::numeric,0)); safety numeric := greatest(sexual, graphic, coalesce((p_signals->>'child_safety_confidence')::numeric,0), coalesce((p_signals->>'hate_confidence')::numeric,0), coalesce((p_signals->>'danger_confidence')::numeric,0)); copyright numeric := greatest(coalesce((p_signals->>'duplicate_score')::numeric,0), coalesce((p_signals->>'copyright_confidence')::numeric,0)); child numeric := coalesce((p_signals->>'child_safety_confidence')::numeric,0); explicit_command boolean := lower(coalesce(p_signals->>'rule_command','')) in ('remove','block','gandi_video','adult_video','graphic_video','child_safety'); confidence numeric; decision text; reason text; reason_code text; enforcement text;
begin
  sexual := least(1,greatest(0,sexual)); graphic := least(1,greatest(0,graphic)); safety := least(1,greatest(0,safety)); copyright := least(1,greatest(0,copyright)); child := least(1,greatest(0,child)); confidence := greatest(safety,copyright);
  if child >= 0.80 then decision := 'REMOVE'; reason_code := 'CHILD_SAFETY_HIGH_CONFIDENCE'; reason := 'High-confidence child-safety signal; content removed from public access and escalated.'; enforcement := 'soft_remove';
  elsif explicit_command or sexual >= 0.90 then decision := 'REMOVE'; reason_code := case when explicit_command then 'ADMIN_RULE_REMOVE' else 'ADULT_OR_SEXUAL_HIGH_CONFIDENCE' end; reason := case when explicit_command then 'Authorized deterministic moderation rule requested removal.' else 'High-confidence adult or sexual-content signal; content removed from public access.' end; enforcement := 'soft_remove';
  elsif graphic >= 0.95 then decision := 'REMOVE'; reason_code := 'GRAPHIC_CONTENT_HIGH_CONFIDENCE'; reason := 'High-confidence graphic-content signal; content removed from public access.'; enforcement := 'soft_remove';
  elsif safety >= 0.90 then decision := 'BLOCK'; reason_code := 'PROHIBITED_SAFETY_HIGH_CONFIDENCE'; reason := 'High-confidence prohibited-safety signal; content blocked pending authorized review.'; enforcement := 'quarantine';
  elsif copyright >= 0.92 then decision := 'REVIEW'; reason_code := 'DUPLICATE_REVIEW'; reason := 'High-confidence duplicate/re-upload signal; no legal ownership asserted.'; enforcement := 'review';
  elsif greatest(safety,copyright) >= 0.60 then decision := 'REVIEW'; reason_code := 'MEDIUM_CONFIDENCE_REVIEW'; reason := 'Medium-confidence signal; private review required.'; enforcement := 'review';
  else decision := 'ALLOW'; reason_code := 'NO_HIGH_CONFIDENCE_SIGNAL'; reason := 'No high-confidence prohibited signal.'; enforcement := 'allow';
  end if;
  return jsonb_build_object('decision',decision,'confidence',confidence,'safety_confidence',safety,'copyright_confidence',copyright,'sexual_confidence',sexual,'graphic_confidence',graphic,'reason_code',reason_code,'reason',reason,'enforcement',enforcement,'policy_version','hktube-policy-2026-10-05');
end
$function$;
create or replace function public.evaluate_video_safety(p_video_id uuid, p_signals jsonb, p_engine_version text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare v_video public.videos; v_decision jsonb; v_assessment uuid; v_severity text;
begin
  select * into v_video from public.videos where id=p_video_id for update;
  if v_video.id is null then raise exception 'video_not_found'; end if;
  v_decision := public.hktube_decide_safety_policy(coalesce(p_signals,'{}'::jsonb));
  insert into public.video_safety_assessments(video_id,uploader_id,engine_version,decision,confidence,safety_confidence,copyright_confidence,reason,signals) values(p_video_id,v_video.creator_id,p_engine_version,v_decision->>'decision',(v_decision->>'confidence')::numeric,(v_decision->>'safety_confidence')::numeric,(v_decision->>'copyright_confidence')::numeric,v_decision->>'reason',coalesce(p_signals,'{}'::jsonb)) returning id into v_assessment;
  if v_decision->>'decision' = 'REMOVE' then
    update public.videos set moderation_confidence=(v_decision->>'confidence')::numeric, detection_engine_version=p_engine_version, moderation_checked_at=now(), review_required=true, moderation_reason=v_decision->>'reason', moderation_status='blocked', status='blocked', visibility='private', published_at=null, deleted_at=now(), allow_download=false, allow_comments=false, mux_playback_id=null where id=p_video_id;
    v_severity := case when v_decision->>'reason_code' = 'CHILD_SAFETY_HIGH_CONFIDENCE' then 'critical' else 'serious' end;
    insert into public.creator_warnings(creator_id,channel_id,video_id,severity,reason_code,reason,metadata) values(v_video.creator_id,v_video.channel_id,p_video_id,v_severity,v_decision->>'reason_code',v_decision->>'reason',jsonb_build_object('assessment_id',v_assessment,'engine_version',p_engine_version,'policy_version',v_decision->>'policy_version'));
    insert into public.moderation_actions(moderator_id,target_type,target_id,action,reason,metadata) values(null,'video',p_video_id,'automated_remove',v_decision->>'reason',jsonb_build_object('assessment_id',v_assessment,'reason_code',v_decision->>'reason_code','policy_version',v_decision->>'policy_version','reversible',true));
  else
    update public.videos set moderation_confidence=(v_decision->>'confidence')::numeric, detection_engine_version=p_engine_version, moderation_checked_at=now(), review_required=(v_decision->>'decision') in ('REVIEW','BLOCK'), moderation_reason=v_decision->>'reason', moderation_status=case when v_decision->>'decision' in ('REVIEW','BLOCK') then 'flagged' else moderation_status end, visibility=case when v_decision->>'decision' in ('REVIEW','BLOCK') then 'private' else visibility end where id=p_video_id;
    insert into public.moderation_actions(moderator_id,target_type,target_id,action,reason,metadata) values(null,'video',p_video_id,case v_decision->>'decision' when 'BLOCK' then 'automated_block' when 'REVIEW' then 'automated_review' else 'automated_allow' end,v_decision->>'reason',jsonb_build_object('assessment_id',v_assessment,'engine_version',p_engine_version,'decision',v_decision));
  end if;
  return jsonb_build_object('assessment_id',v_assessment,'video_id',p_video_id) || v_decision;
end
$function$;
create or replace function public.enforce_video_by_command(p_video_id uuid, p_command text, p_reason text default 'Authorized deterministic moderation command')
returns jsonb language plpgsql security definer set search_path = pg_catalog, public
as $function$
begin
  if lower(trim(p_command)) not in ('remove','block','gandi_video','adult_video','graphic_video','child_safety') then raise exception 'unsupported_enforcement_command'; end if;
  return public.evaluate_video_safety(p_video_id, jsonb_build_object('rule_command',lower(trim(p_command)),'manual_reason',left(p_reason,1000)), 'hktube-rule-engine/1.0');
end
$function$;
revoke execute on function public.hktube_decide_safety_policy(jsonb), public.evaluate_video_safety(uuid,jsonb,text), public.enforce_video_by_command(uuid,text,text) from public, anon, authenticated;
grant execute on function public.hktube_decide_safety_policy(jsonb), public.evaluate_video_safety(uuid,jsonb,text), public.enforce_video_by_command(uuid,text,text) to service_role;
