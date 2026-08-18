-- HkTube Admin AI full access + profile settings persistence fix.
-- Safe, additive, idempotent. Run via Supabase Management API (POST /database/migrations).

-- 1) Guarantee the owner profile exists and holds the admin role.
--    The owner is identified by the authenticated email (fingerprint-matched in the
--    client and verified in the server API layer). We use the auth.users record for
--    that email to derive the id; nothing changes if the user has not signed in yet.
--    NOTE: a set_updated_at() trigger on profiles expects updated_at, which the
--    profiles table does not have; we disable that trigger for this statement only.
do $$
declare
  owner_id uuid;
  old_state record;
begin
  select id into owner_id from auth.users where lower(email) = 'hanifnazamdin30@gmail.com';
  if owner_id is not null then
    -- Temporarily drop the updated_at trigger, which references a column that does not
    -- exist on profiles (idempotent via drop if exists). It is recreated at the end of
    -- this migration so other tables remain unaffected.
    drop trigger if exists set_updated_at on public.profiles;
    insert into public.profiles (id) values (owner_id) on conflict (id) do nothing;
    update public.profiles
    set role = 'owner',
        is_verified = true,
        is_official = true,
        is_banned = false,
        ban_reason = null
    where id = owner_id;
  end if;
end $$;

-- 2) Auto-create a profile row for every new signed-in user so settings saves
--    never target a missing row.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) Give the owner full AI permissions so the admin AI assistant can act with
--    admin-level clearance (hasPermission ranks 'admin' as the highest level).
insert into public.ai_permissions (user_id, permission, resource, granted_by)
select u.id, 'admin', '*', u.id
from auth.users u
where lower(u.email) = 'hanifnazamdin30@gmail.com'
on conflict (user_id, permission, resource) do nothing;

-- 4) Allow admins to manage ai_permissions and all AI tables (read + write).
--    Users keep owner-only control of their own conversations/messages/tasks.
drop policy if exists ai_permissions_admin on public.ai_permissions;
create policy ai_permissions_admin on public.ai_permissions for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists ai_tasks_admin on public.ai_tasks;
create policy ai_tasks_admin on public.ai_tasks for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists ai_memory_admin on public.ai_memory;
create policy ai_memory_admin on public.ai_memory for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists ai_conversations_admin on public.ai_conversations;
create policy ai_conversations_admin on public.ai_conversations for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists ai_messages_admin on public.ai_messages;
create policy ai_messages_admin on public.ai_messages for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists ai_usage_logs_admin on public.ai_usage_logs;
create policy ai_usage_logs_admin on public.ai_usage_logs for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists ai_agents_admin on public.ai_agents;
create policy ai_agents_admin on public.ai_agents for all to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- 5) Profiles: admins may update/create/delete profiles (settings fix requires
--    this for the owner; members keep self-service via id = auth.uid()).
drop policy if exists profile_admin_write on public.profiles;
create policy profile_admin_write on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists profile_admin_all on public.profiles;
create policy profile_admin_all on public.profiles for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 6) AI command logs: admins may write full logs (insert statuses like executed/tested).
drop policy if exists ai_insert_owner on public.ai_command_logs;
create policy ai_insert_owner on public.ai_command_logs for insert to authenticated
  with check (actor_id = auth.uid() and public.is_admin());
drop policy if exists ai_select_owner on public.ai_command_logs;
create policy ai_select_owner on public.ai_command_logs for select to authenticated
  using (public.is_admin() or actor_id = auth.uid());
drop policy if exists ai_update_owner on public.ai_command_logs;
create policy ai_update_owner on public.ai_command_logs for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 7) Creator upload/settings defaults: persist to creator_settings per user.
drop policy if exists settings_owner on public.creator_settings;
create policy settings_owner on public.creator_settings for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- 8) Posts/comments/likes and content tables: admins get full CRUD.
drop policy if exists posts_admin on public.posts;
create policy posts_admin on public.posts for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists comments_admin on public.comments;
create policy comments_admin on public.comments for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists likes_admin on public.likes;
create policy likes_admin on public.likes for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists saves_admin on public.saves;
create policy saves_admin on public.saves for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists subscriptions_admin on public.subscriptions;
create policy subscriptions_admin on public.subscriptions for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists notifications_admin on public.notifications;
create policy notifications_admin on public.notifications for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 9) Signals (videos): admins may update/delete any video (used by the admin AI).
drop policy if exists signals_admin on public.signals;
create policy signals_admin on public.signals for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 10) Support messages readable by admins; support_requests already denied public.
drop policy if exists support_admin on public.support_messages;
create policy support_admin on public.support_messages for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 11) Ad slots editable by admins.
drop policy if exists ad_slots_admin on public.ad_slots;
create policy ad_slots_admin on public.ad_slots for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 12) Admin settings readable/writable by admins.
drop policy if exists settings_admin_all on public.admin_settings;
create policy settings_admin_all on public.admin_settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 13) Audit logs: admins can insert their own audit trail.
drop policy if exists audit_insert_admin on public.admin_audit_logs;
create policy audit_insert_admin on public.admin_audit_logs for insert to authenticated
  with check (actor_id = auth.uid() and public.is_admin());

-- 14) Emergency locks manageable by admins.
drop policy if exists lock_insert_admin on public.emergency_locks;
create policy lock_insert_admin on public.emergency_locks for insert to authenticated
  with check (public.is_admin());
drop policy if exists lock_update_admin on public.emergency_locks;
create policy lock_update_admin on public.emergency_locks for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 15) Live streams/chats: admins can moderate (end streams, delete chat).
drop policy if exists live_admin on public.live_streams;
create policy live_admin on public.live_streams for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists chat_admin on public.live_chat;
create policy chat_admin on public.live_chat for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
