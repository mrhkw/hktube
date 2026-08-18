-- ============================================================
-- HkTube — Fix 403 "new row violates policy" on video uploads
-- ============================================================
-- Applied to production via the Supabase Management API
-- (POST /v1/projects/<ref>/database/query) on 2026-08-18.
-- Kept here as the authoritative record of the storage policy
-- configuration. All four buckets (videos, shorts, thumbnails,
-- avatars) are public buckets; authenticated users may upload
-- into any of them, read them, and manage their own files.

-- NOTE: storage.objects is owned by supabase_storage_admin, so
-- ALTER/DROP statements must be executed by the project owner
-- role (postgres). The Management API /database/migrations
-- endpoint runs as a limited role and will fail with
-- "must be owner of table objects"; use the direct query
-- endpoint (/database/query) instead.

-- 1. Remove stale per-bucket policies so the general policies
--    below take effect cleanly.
DO $$
BEGIN
  EXECUTE (SELECT coalesce(string_agg(format('DROP POLICY IF EXISTS %I ON storage.objects', polname), E'\n'), '')
           FROM pg_policy WHERE polrelid = 'storage.objects'::regclass);
END $$;

-- 2. Keep RLS enabled (it is on by default for the storage
--    extension).
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Authenticated users may upload into the known buckets.
CREATE POLICY "authenticated upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('videos', 'shorts', 'thumbnails', 'avatars'));

-- 4. Anyone (signed in or anonymous) may read objects from the
--    public buckets — matching the buckets' public=true flag.
CREATE POLICY "public read" ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (bucket_id IN ('videos', 'shorts', 'thumbnails', 'avatars'));

-- 5. Owners may update their own objects (e.g. upserting a new
--    file to the same path).
CREATE POLICY "owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (owner = auth.uid())
  WITH CHECK (owner = auth.uid());

-- 6. Owners may delete their own objects.
CREATE POLICY "owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (owner = auth.uid());
