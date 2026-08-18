-- Round 4: admin channels/users/moderation/notifications + channel links
-- Owner gets platform-wide admin rights; notifications/comments RLS fixed;
-- channels table (real) gets RLS + unique handle; channel links /c/:handle.

-- 1. Notifications RLS: use real columns (type, title, body, read_at).
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_read_own ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_service ON public.notifications;
CREATE POLICY notifications_read_own ON public.notifications
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'));
CREATE POLICY notifications_insert_service ON public.notifications
  FOR INSERT WITH CHECK (true);

-- 2. Comments moderation: owner can delete any comment
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS comments_owner_delete ON public.comments;
CREATE POLICY comments_owner_delete ON public.comments
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'));

-- 3. Channels table RLS: owners write their own channel; public reads all;
--    owner/admin can do anything. Handles are unique (channel links).
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS channel_admin ON public.channels;
DROP POLICY IF EXISTS channel_owner_write ON public.channels;
DROP POLICY IF EXISTS channel_public_read ON public.channels;
CREATE POLICY channel_admin ON public.channels FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'));
CREATE POLICY channel_owner_write ON public.channels
  FOR ALL USING (owner_id = auth.uid());
CREATE POLICY channel_public_read ON public.channels
  FOR SELECT USING (true);

DROP TRIGGER IF EXISTS channels_handle_unique ON public.channels;
ALTER TABLE public.channels DROP CONSTRAINT IF EXISTS channels_handle_key;
ALTER TABLE public.channels ADD CONSTRAINT channels_handle_key UNIQUE (handle);
-- handle format: lowercase letters/numbers/underscores/dashes
ALTER TABLE public.channels DROP CONSTRAINT IF EXISTS channels_handle_check;
ALTER TABLE public.channels ADD CONSTRAINT channels_handle_check
  CHECK (handle ~ '^[a-z0-9][a-z0-9_.-]{1,38}$');

-- 4. Owner enforcement at policy level: banned non-owners cannot act
DROP POLICY IF EXISTS profiles_not_banned ON public.profiles;
CREATE POLICY profiles_not_banned ON public.profiles
  FOR ALL USING (COALESCE(is_banned, false) = false OR COALESCE(role, 'viewer') = 'owner');

-- 5. Ensure owner reads always succeed
DROP POLICY IF EXISTS profiles_owner_read ON public.profiles;
CREATE POLICY profiles_owner_read ON public.profiles FOR SELECT USING (true);

-- 6. Seed/update owner profile flags
UPDATE public.profiles
SET role = 'owner', is_admin = true, is_verified = true, is_official = true, is_banned = false
WHERE EXISTS (SELECT 1 FROM auth.users WHERE auth.users.email = 'hanifnazamdin30@gmail.com' AND auth.users.id = profiles.id);

-- 7. Seed owner channel link target: create owner's own channel row if missing
INSERT INTO public.channels (id, owner_id, handle, name, subscriber_count)
SELECT u.id, u.id, 'hktube', 'HkTube Official', 0
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'hanifnazamdin30@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM public.channels c WHERE c.owner_id = u.id)
ON CONFLICT DO NOTHING;
