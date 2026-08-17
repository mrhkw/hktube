-- Provision the buckets used by the Vite client. This is safe to run more than once.
insert into storage.buckets (id, name, public)
values
  ('videos', 'videos', true),
  ('shorts', 'shorts', true),
  ('thumbnails', 'thumbnails', true)
on conflict (id) do update set public = excluded.public;

-- Allow signed-in creators to manage files below their own user-id folder.
drop policy if exists hktube_storage_insert_own on storage.objects;
create policy hktube_storage_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id in ('videos', 'shorts', 'thumbnails')
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists hktube_storage_update_own on storage.objects;
create policy hktube_storage_update_own
on storage.objects for update to authenticated
using (
  bucket_id in ('videos', 'shorts', 'thumbnails')
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id in ('videos', 'shorts', 'thumbnails')
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists hktube_storage_delete_own on storage.objects;
create policy hktube_storage_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id in ('videos', 'shorts', 'thumbnails')
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
