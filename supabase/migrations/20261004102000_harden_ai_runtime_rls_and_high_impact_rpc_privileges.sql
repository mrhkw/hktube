-- Runtime control-plane tables are never direct client surfaces.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ai_runtime_agents','ai_runtime_approvals','ai_runtime_audit','ai_runtime_events',
    'ai_runtime_health','ai_runtime_integrations','ai_runtime_memories',
    'ai_runtime_notifications','ai_runtime_tasks','ai_runtime_teams'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS hktube_runtime_service_role_only ON public.%I', t);
    EXECUTE format('CREATE POLICY hktube_runtime_service_role_only ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
  END LOOP;
END $$;

-- Browser roles must not execute high-impact moderation, ban, or publication RPCs.
REVOKE EXECUTE ON FUNCTION public.auto_publish_video() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ban_user(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.moderate_video(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.moderate_video(uuid, moderation_status) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.moderation_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_video_report(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_video_report(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_profile_for_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_effective_safety_policy(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_publish_video() TO service_role;
GRANT EXECUTE ON FUNCTION public.ban_user(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.moderate_video(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.moderate_video(uuid, moderation_status) TO service_role;
GRANT EXECUTE ON FUNCTION public.moderation_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_video_report(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_video_report(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_profile_for_auth_user() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.get_effective_safety_policy(text) TO service_role;
