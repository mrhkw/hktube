grant select on public.creator_warnings to authenticated;
drop policy if exists creator_warning_owner_read on public.creator_warnings;
create policy creator_warning_owner_read on public.creator_warnings for select to authenticated using (creator_id = auth.uid());
