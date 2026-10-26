-- HkTube security hardening: admin settings, message membership, and comment RPC.
-- Applied to the connected Supabase project on 2026-10-26; kept in source control for auditability.

drop policy if exists "Allow insert/update on admin_settings" on public.admin_settings;
drop policy if exists "settings_select_authenticated" on public.admin_settings;
revoke all privileges on table public.admin_settings from anon;
revoke truncate, references, trigger on table public.admin_settings from authenticated;
grant select, insert, update, delete on table public.admin_settings to authenticated;

drop policy if exists "messages_member_select" on public.messages;
create policy "messages_member_select" on public.messages
for select to authenticated
using (
  exists (
    select 1 from public.conversation_members m
    where m.conversation_id = messages.conversation_id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "messages_sender_write" on public.messages;
create policy "messages_sender_write" on public.messages
for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.conversation_members m
    where m.conversation_id = messages.conversation_id
      and m.user_id = (select auth.uid())
  )
);

revoke execute on function public.add_video_comment(uuid, text, uuid) from public, anon;
grant execute on function public.add_video_comment(uuid, text, uuid) to authenticated;
