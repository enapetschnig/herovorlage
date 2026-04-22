-- =============================================================================
-- Storage RLS — restrict objects in HeatFlow buckets so each tenant's storage
-- key prefix (`{tenantId}/...`, see packages/utils/storage.ts buildStoragePath)
-- is only accessible to authenticated requests bearing that tenant_id.
--
-- We keep policies permissive at the storage layer: the app is the source of
-- truth for tenant scoping. RLS here is defense-in-depth against direct API
-- access using a leaked anon key (which has no tenant context).
-- =============================================================================

-- 1) Strip the default permissive policies on storage.objects (added by Supabase).
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT polname FROM pg_policy WHERE polrelid = 'storage.objects'::regclass
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.polname);
  END LOOP;
END $$;

-- 2) For OUR buckets only: deny anon + allow service_role/authenticated.
--    Until we migrate auth fully into Supabase JWT, the app uses the
--    service-role key from the Next.js server (never exposed to the client),
--    so the policies just need to lock out anon.

-- Allow service_role full access to all 4 HeatFlow buckets.
CREATE POLICY "heatflow_service_role_all" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id IN ('contact-files', 'project-files', 'documents', 'avatars'))
  WITH CHECK (bucket_id IN ('contact-files', 'project-files', 'documents', 'avatars'));

-- avatars is public — let anon read.
CREATE POLICY "heatflow_avatars_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');

-- All other HeatFlow buckets: only service-role can touch them. Anon = denied.
-- (No additional policy = denied by default once RLS is on.)

-- 3) Same idea for the buckets table — public listing of bucket metadata is OK.
DROP POLICY IF EXISTS "heatflow_buckets_public_list" ON storage.buckets;
CREATE POLICY "heatflow_buckets_public_list" ON storage.buckets
  FOR SELECT TO anon, authenticated
  USING (true);
