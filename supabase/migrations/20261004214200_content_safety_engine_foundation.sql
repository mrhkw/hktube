alter table public.videos add column if not exists moderation_confidence numeric(5,4) check (moderation_confidence is null or moderation_confidence between 0 and 1);
alter table public.videos add column if not exists copyright_status text not null default 'clear' check (copyright_status in ('clear','potential_match','high_confidence_match','blocked','review_required','appealed'));
alter table public.videos add column if not exists copyright_confidence numeric(5,4) check (copyright_confidence is null or copyright_confidence between 0 and 1);
alter table public.videos add column if not exists duplicate_score numeric(5,4) check (duplicate_score is null or duplicate_score between 0 and 1);
alter table public.videos add column if not exists content_fingerprint text;
alter table public.videos add column if not exists detection_engine_version text;
alter table public.videos add column if not exists review_required boolean not null default false;

create index if not exists videos_moderation_status_created_idx on public.videos (moderation_status, created_at desc);
create index if not exists videos_copyright_status_created_idx on public.videos (copyright_status, created_at desc);
create index if not exists videos_fingerprint_idx on public.videos (content_fingerprint) where content_fingerprint is not null;

create table if not exists public.video_safety_assessments (
  id uuid primary key default gen_random_uuid(), video_id uuid not null references public.videos(id) on delete cascade,
  uploader_id uuid not null, engine_version text not null,
  decision text not null check (decision in ('ALLOW','REVIEW','BLOCK','REMOVE','RESTORE')),
  confidence numeric(5,4) not null check (confidence between 0 and 1), safety_confidence numeric(5,4) not null default 0 check (safety_confidence between 0 and 1), copyright_confidence numeric(5,4) not null default 0 check (copyright_confidence between 0 and 1), reason text not null, signals jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), reviewed_at timestamptz, reviewer_id uuid
);
create index if not exists video_safety_assessments_video_idx on public.video_safety_assessments(video_id, created_at desc);
create index if not exists video_safety_assessments_decision_idx on public.video_safety_assessments(decision, created_at desc);

create table if not exists public.video_fingerprints (
  id uuid primary key default gen_random_uuid(), video_id uuid not null references public.videos(id) on delete cascade, uploader_id uuid not null, sha256 text, perceptual_hash text, audio_hash text, watermark_signal text not null default 'unknown' check (watermark_signal in ('detected','not_detected','unknown')), duplicate_score numeric(5,4) not null default 0 check (duplicate_score between 0 and 1), matched_video_id uuid references public.videos(id) on delete set null, engine_version text not null, created_at timestamptz not null default now()
);
create index if not exists video_fingerprints_sha256_idx on public.video_fingerprints(sha256) where sha256 is not null;
create index if not exists video_fingerprints_video_idx on public.video_fingerprints(video_id, created_at desc);

create table if not exists public.video_appeals (
  id uuid primary key default gen_random_uuid(), video_id uuid not null references public.videos(id) on delete cascade, appellant_id uuid not null, reason text not null check (length(reason) between 10 and 10000), evidence jsonb not null default '{}'::jsonb, status text not null default 'pending' check (status in ('pending','approved','rejected')), reviewer_id uuid, created_at timestamptz not null default now(), reviewed_at timestamptz
);
create index if not exists video_appeals_status_created_idx on public.video_appeals(status, created_at desc);
create index if not exists video_appeals_video_idx on public.video_appeals(video_id, created_at desc);

alter table public.video_safety_assessments enable row level security;
alter table public.video_fingerprints enable row level security;
alter table public.video_appeals enable row level security;
revoke all on table public.video_safety_assessments, public.video_fingerprints from anon, authenticated;
grant all on table public.video_safety_assessments, public.video_fingerprints to service_role;
drop policy if exists hktube_safety_service_role_only on public.video_safety_assessments;
drop policy if exists hktube_fingerprint_service_role_only on public.video_fingerprints;
create policy hktube_safety_service_role_only on public.video_safety_assessments for all to service_role using (true) with check (true);
create policy hktube_fingerprint_service_role_only on public.video_fingerprints for all to service_role using (true) with check (true);
drop policy if exists hktube_appeals_owner_read_insert on public.video_appeals;
drop policy if exists hktube_appeals_admin_all on public.video_appeals;
create policy hktube_appeals_owner_read_insert on public.video_appeals for select to authenticated using (appellant_id = auth.uid());
create policy hktube_appeals_owner_insert on public.video_appeals for insert to authenticated with check (appellant_id = auth.uid());
create policy hktube_appeals_admin_all on public.video_appeals for all to authenticated using (private.is_admin()) with check (private.is_admin());
grant select, insert on public.video_appeals to authenticated;
grant all on public.video_appeals to service_role;

create or replace function public.hktube_decide_safety_policy(p_signals jsonb)
returns jsonb language plpgsql immutable security definer set search_path = pg_catalog, public
as $function$
declare
  safety numeric := greatest(coalesce((p_signals->>'sexual_confidence')::numeric,0), coalesce((p_signals->>'child_safety_confidence')::numeric,0), coalesce((p_signals->>'violence_confidence')::numeric,0), coalesce((p_signals->>'graphic_confidence')::numeric,0), coalesce((p_signals->>'hate_confidence')::numeric,0), coalesce((p_signals->>'danger_confidence')::numeric,0));
  copyright numeric := greatest(coalesce((p_signals->>'duplicate_score')::numeric,0), coalesce((p_signals->>'copyright_confidence')::numeric,0));
  child numeric := coalesce((p_signals->>'child_safety_confidence')::numeric,0);
  confidence numeric; decision text; reason text;
begin
  safety := least(1,greatest(0,safety)); copyright := least(1,greatest(0,copyright)); child := least(1,greatest(0,child)); confidence := greatest(safety,copyright);
  if child >= 0.80 then decision := 'BLOCK'; reason := 'Suspected child-safety signal; quarantined for authorized review.';
  elsif safety >= 0.90 then decision := 'BLOCK'; reason := 'High-confidence prohibited-safety signal.';
  elsif copyright >= 0.92 then decision := 'REVIEW'; reason := 'High-confidence duplicate/re-upload signal; not a legal ownership finding.';
  elsif greatest(safety,copyright) >= 0.60 then decision := 'REVIEW'; reason := 'Medium-confidence safety or re-upload signal.';
  else decision := 'ALLOW'; reason := 'No high-confidence prohibited or duplicate signal.';
  end if;
  return jsonb_build_object('decision',decision,'confidence',confidence,'safety_confidence',safety,'copyright_confidence',copyright,'reason',reason);
end
$function$;

create or replace function public.register_video_fingerprint(p_video_id uuid, p_sha256 text, p_perceptual_hash text, p_audio_hash text, p_watermark_signal text, p_engine_version text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare v_video public.videos; v_match uuid; v_duplicate numeric := 0; v_status text := 'clear';
begin
  select * into v_video from public.videos where id=p_video_id for update;
  if v_video.id is null then raise exception 'video_not_found'; end if;
  if p_sha256 is null and p_perceptual_hash is null and p_audio_hash is null then raise exception 'fingerprint_required'; end if;
  select video_id into v_match from public.video_fingerprints where video_id <> p_video_id and p_sha256 is not null and sha256 = p_sha256 order by created_at asc limit 1;
  if v_match is not null then v_duplicate := 1; v_status := 'high_confidence_match'; end if;
  insert into public.video_fingerprints(video_id,uploader_id,sha256,perceptual_hash,audio_hash,watermark_signal,duplicate_score,matched_video_id,engine_version) values(p_video_id,v_video.creator_id,p_sha256,p_perceptual_hash,p_audio_hash,coalesce(p_watermark_signal,'unknown'),v_duplicate,v_match,p_engine_version);
  update public.videos set content_fingerprint=coalesce(p_sha256,p_perceptual_hash,p_audio_hash), duplicate_score=v_duplicate, copyright_status=v_status, copyright_confidence=v_duplicate, detection_engine_version=p_engine_version, review_required=(v_match is not null), moderation_status=case when v_match is not null then 'flagged' else moderation_status end, visibility=case when v_match is not null then 'private' else visibility end, moderation_reason=case when v_match is not null then 'Potential exact duplicate of existing HkTube media; not a legal ownership determination.' else moderation_reason end where id=p_video_id;
  if v_match is not null then insert into public.moderation_actions(moderator_id,target_type,target_id,action,reason,metadata) values(null,'video',p_video_id,'automated_duplicate_review','Potential exact duplicate; no ownership asserted.',jsonb_build_object('matched_video_id',v_match,'duplicate_score',v_duplicate,'engine_version',p_engine_version)); end if;
  return jsonb_build_object('video_id',p_video_id,'matched_video_id',v_match,'duplicate_score',v_duplicate,'copyright_status',v_status,'legal_ownership_claim',false);
end
$function$;

create or replace function public.evaluate_video_safety(p_video_id uuid, p_signals jsonb, p_engine_version text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare v_video public.videos; v_decision jsonb; v_assessment uuid;
begin
  select * into v_video from public.videos where id=p_video_id for update;
  if v_video.id is null then raise exception 'video_not_found'; end if;
  v_decision := public.hktube_decide_safety_policy(coalesce(p_signals,'{}'::jsonb));
  insert into public.video_safety_assessments(video_id,uploader_id,engine_version,decision,confidence,safety_confidence,copyright_confidence,reason,signals) values(p_video_id,v_video.creator_id,p_engine_version,v_decision->>'decision',(v_decision->>'confidence')::numeric,(v_decision->>'safety_confidence')::numeric,(v_decision->>'copyright_confidence')::numeric,v_decision->>'reason',coalesce(p_signals,'{}'::jsonb)) returning id into v_assessment;
  update public.videos set moderation_confidence=(v_decision->>'confidence')::numeric, detection_engine_version=p_engine_version, moderation_checked_at=now(), review_required=(v_decision->>'decision') in ('REVIEW','BLOCK'), moderation_reason=v_decision->>'reason', moderation_status=case when v_decision->>'decision' in ('BLOCK','REVIEW') then 'flagged' else moderation_status end, visibility=case when v_decision->>'decision' in ('REVIEW','BLOCK') then 'private' else visibility end where id=p_video_id;
  insert into public.moderation_actions(moderator_id,target_type,target_id,action,reason,metadata) values(null,'video',p_video_id,case v_decision->>'decision' when 'BLOCK' then 'automated_block' when 'REVIEW' then 'automated_review' else 'automated_allow' end,v_decision->>'reason',jsonb_build_object('assessment_id',v_assessment,'engine_version',p_engine_version,'decision',v_decision));
  return jsonb_build_object('assessment_id',v_assessment,'video_id',p_video_id) || v_decision;
end
$function$;

revoke execute on function public.hktube_decide_safety_policy(jsonb) from public, anon, authenticated;
revoke execute on function public.register_video_fingerprint(uuid,text,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.evaluate_video_safety(uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.hktube_decide_safety_policy(jsonb) to service_role;
grant execute on function public.register_video_fingerprint(uuid,text,text,text,text,text) to service_role;
grant execute on function public.evaluate_video_safety(uuid,jsonb,text) to service_role;
