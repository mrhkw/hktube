-- HkTube media safety baseline.
-- This script is intentionally idempotent and only targets the existing Supabase
-- videos/comments tables used by the client. It does not create a second schema.

alter table if exists public.videos enable row level security;
alter table if exists public.comments enable row level security;

drop policy if exists "hktube_public_read_published_videos" on public.videos;
create policy "hktube_public_read_published_videos"
on public.videos for select
to anon, authenticated
using (
  (visibility = 'public' and status = 'published' and moderation_status = 'approved')
  or creator_id = auth.uid()
);

drop policy if exists "hktube_owner_insert_videos" on public.videos;
create policy "hktube_owner_insert_videos"
on public.videos for insert
to authenticated
with check (creator_id = auth.uid());

drop policy if exists "hktube_owner_update_videos" on public.videos;
create policy "hktube_owner_update_videos"
on public.videos for update
to authenticated
using (creator_id = auth.uid())
with check (creator_id = auth.uid());

drop policy if exists "hktube_owner_delete_videos" on public.videos;
create policy "hktube_owner_delete_videos"
on public.videos for delete
to authenticated
using (creator_id = auth.uid());

drop policy if exists "hktube_public_read_approved_comments" on public.comments;
create policy "hktube_public_read_approved_comments"
on public.comments for select
to anon, authenticated
using (moderation_status = 'approved' or author_id = auth.uid());

drop policy if exists "hktube_authenticated_insert_comments" on public.comments;
create policy "hktube_authenticated_insert_comments"
on public.comments for insert
to authenticated
with check (author_id = auth.uid());

drop policy if exists "hktube_comment_author_update" on public.comments;
create policy "hktube_comment_author_update"
on public.comments for update
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

drop policy if exists "hktube_comment_author_delete" on public.comments;
create policy "hktube_comment_author_delete"
on public.comments for delete
to authenticated
using (author_id = auth.uid());

-- Least privilege for the client roles. RLS remains the authorization layer.
grant select on public.videos to anon, authenticated;
grant insert, update, delete on public.videos to authenticated;
grant select on public.comments to anon, authenticated;
grant insert, update, delete on public.comments to authenticated;
