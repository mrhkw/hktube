-- HkTube Storage: private-by-default uploads with owner-scoped paths.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('videos','videos',false,536870912,ARRAY['video/mp4','video/webm','video/quicktime','video/x-matroska']),
  ('shorts','shorts',false,268435456,ARRAY['video/mp4','video/webm','video/quicktime']),
  ('thumbnails','thumbnails',true,10485760,ARRAY['image/jpeg','image/png','image/webp']),
  ('avatars','avatars',true,5242880,ARRAY['image/jpeg','image/png','image/webp']),
  ('banners','banners',true,10485760,ARRAY['image/jpeg','image/png','image/webp']),
  ('post-media','post-media',false,52428800,ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_owner(path text) returns uuid language sql stable security definer set search_path = public as $$ select nullif(split_part(path, '/', 1), '')::uuid $$;

drop policy if exists storage_owner_insert on storage.objects;
drop policy if exists storage_owner_update on storage.objects;
drop policy if exists storage_owner_delete on storage.objects;
drop policy if exists storage_public_read on storage.objects;
create policy storage_owner_insert on storage.objects for insert to authenticated with check (bucket_id in ('videos','shorts','thumbnails','avatars','banners','post-media') and public.storage_owner(name) = auth.uid());
create policy storage_owner_update on storage.objects for update to authenticated using (owner_id = auth.uid() or public.storage_owner(name) = auth.uid()) with check (owner_id = auth.uid() or public.storage_owner(name) = auth.uid());
create policy storage_owner_delete on storage.objects for delete to authenticated using (owner_id = auth.uid() or public.storage_owner(name) = auth.uid());
create policy storage_public_read on storage.objects for select using (bucket_id in ('thumbnails','avatars','banners') or (bucket_id = 'videos' and exists (select 1 from public.videos v where v.video_path = name and v.visibility = 'public' and v.status = 'published')) or (bucket_id = 'shorts' and exists (select 1 from public.shorts s where s.video_path = name and s.visibility = 'public' and s.status = 'published')));
