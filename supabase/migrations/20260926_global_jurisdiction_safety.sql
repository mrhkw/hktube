alter table public.profiles
  add column if not exists country_code char(2),
  add column if not exists age_band text;

do $$ begin
  alter table public.profiles
    add constraint profiles_country_code_ck
    check (country_code is null or country_code ~ '^[A-Z]{2}$');
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.profiles
    add constraint profiles_age_band_ck
    check (age_band is null or age_band in ('under_13','13_15','16_17','18_plus'));
exception when duplicate_object then null;
end $$;

create table if not exists public.jurisdiction_policies (
  code text primary key,
  name text not null,
  source_urls text[] not null default '{}',
  policy_version text not null,
  effective_from date not null,
  rules jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.jurisdiction_policies enable row level security;
drop policy if exists "public_can_read_jurisdiction_policies" on public.jurisdiction_policies;
create policy "public_can_read_jurisdiction_policies"
on public.jurisdiction_policies for select to public using (true);

insert into public.jurisdiction_policies(code,name,source_urls,policy_version,effective_from,rules)
values
('UN','UN baseline','https://www.un.org/en/node/124305,https://www.un.org/pact-for-the-future/en/annex-i-global-digital-compact','2026-09-baseline','2026-09-26',
 '{"principles":["human_rights","privacy","freedom_of_expression","non_discrimination","child_best_interests","safety","redress"],"moderation":"lawful_necessary_proportionate","child_protection":true}'::jsonb),
('EU','European Union','https://digital-strategy.ec.europa.eu/en/policies/digital-services-act-package','2026-09','2026-09-26',
 '{"notice_action":true,"transparency":true,"minor_safety":true,"appeal":true,"privacy_by_design":true}'::jsonb),
('GB','United Kingdom','https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/guide-for-services','2026-09','2026-09-26',
 '{"illegal_content_safety":true,"child_safety":true,"risk_assessment":true,"user_rights":true}'::jsonb),
('AU','Australia','https://www.esafety.gov.au/about-us/industry-regulation/social-media-age-restrictions','2026-09','2026-09-26',
 '{"under_16_account_restriction":true,"online_safety_expectations":true,"child_safety":true}'::jsonb),
('US','United States','https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa','2026-09','2026-09-26',
 '{"coppa_under_13":true,"parental_consent_when_applicable":true,"child_data_minimization":true}'::jsonb),
('BR','Brazil','https://www.gov.br/mdh/pt-br/assuntos/noticias/2026/defeso-eleitoral/agosto/eca-digital-conheca-as-regras-de-protecao-de-criancas-e-adolescentes-no-ambiente-online','2026-09','2026-09-26',
 '{"child_safety":true,"privacy":true,"age_assurance":true,"parental_supervision":true}'::jsonb),
('IN','India','https://www.meity.gov.in/','2026-09','2026-09-26',
 '{"local_law_review_required":true,"grievance_process":true,"privacy":true}'::jsonb),
('PK','Pakistan','https://www.moitt.gov.pk/','2026-09','2026-09-26',
 '{"local_law_review_required":true,"content_reporting":true,"child_safety":true}'::jsonb)
on conflict(code) do update set name=excluded.name,source_urls=excluded.source_urls,policy_version=excluded.policy_version,effective_from=excluded.effective_from,rules=excluded.rules,updated_at=now();

create or replace function public.get_effective_safety_policy(p_country_code text)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'global', (select rules from public.jurisdiction_policies where code='UN'),
    'jurisdiction', coalesce((select rules from public.jurisdiction_policies where code=upper(p_country_code)), '{}'::jsonb)
  );
$$;

revoke all on function public.get_effective_safety_policy(text) from public;
grant execute on function public.get_effective_safety_policy(text) to anon, authenticated;
