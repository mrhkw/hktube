create or replace function public.ensure_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare base_username text; candidate text;
begin
  if exists (select 1 from public.profiles where id = new.id) then return new; end if;
  base_username := lower(regexp_replace(coalesce(nullif(new.raw_user_meta_data->>'username',''),nullif(new.raw_user_meta_data->>'preferred_username',''),split_part(coalesce(new.email,''),'@',1),'creator'),'[^a-z0-9_]+','_','g'));
  base_username := trim(both '_' from left(base_username,48));
  if base_username='' then base_username:='creator'; end if;
  candidate := left(base_username,39)||'_'||substr(replace(new.id::text,'-',''),1,8);
  insert into public.profiles(id,username,display_name,avatar_url)
  values(new.id,candidate,left(coalesce(nullif(new.raw_user_meta_data->>'full_name',''),nullif(new.raw_user_meta_data->>'name',''),candidate),120),nullif(new.raw_user_meta_data->>'avatar_url',''))
  on conflict(id) do nothing;
  return new;
end $$;
revoke all on function public.ensure_profile_for_auth_user() from public;
grant execute on function public.ensure_profile_for_auth_user() to supabase_auth_admin;
drop trigger if exists on_auth_user_created_hktube_profile on auth.users;
create trigger on_auth_user_created_hktube_profile after insert on auth.users for each row execute function public.ensure_profile_for_auth_user();
insert into public.profiles(id,username,display_name,avatar_url)
select u.id,
       left(trim(both '_' from regexp_replace(lower(regexp_replace(coalesce(nullif(u.raw_user_meta_data->>'username',''),split_part(coalesce(u.email,''),'@',1),'creator'),'[^a-z0-9_]+','_','g')),'^_+|_+$','','g')),39)||'_'||substr(replace(u.id::text,'-',''),1,8),
       left(coalesce(nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name',''),split_part(coalesce(u.email,''),'@',1),'HkTube member'),120),
       nullif(u.raw_user_meta_data->>'avatar_url','')
from auth.users u where not exists(select 1 from public.profiles p where p.id=u.id)
on conflict(id) do nothing;