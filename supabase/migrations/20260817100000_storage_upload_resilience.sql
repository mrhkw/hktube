-- Storage setup for the four client upload buckets.
-- Apply through the Supabase SQL Editor or migration runner.
insert into storage.buckets (id, name, public)
values
  ('videos', 'videos', true),
  ('shorts', 'shorts', true),
  ('thumbnails', 'thumbnails', true),
  ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

-- Keep uploads scoped to the authenticated user's first path segment.
drop policy if exists hktube_storage_insert_own on storage.objects;
create policy hktube_storage_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id in ('videos', 'shorts', 'thumbnails', 'avatars')
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists hktube_storage_select_public on storage.objects;
create policy hktube_storage_select_public
on storage.objects for select to anon, authenticated
using (bucket_id in ('videos', 'shorts', 'thumbnails', 'avatars'));

drop policy if exists hktube_storage_update_own on storage.objects;
create policy hktube_storage_update_own
on storage.objects for update to authenticated
using (
  bucket_id in ('videos', 'shorts', 'thumbnails', 'avatars')
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id in ('videos', 'shorts', 'thumbnails', 'avatars')
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists hktube_storage_delete_own on storage.objects;
create policy hktube_storage_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id in ('videos', 'shorts', 'thumbnails', 'avatars')
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
