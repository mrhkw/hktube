-- Restrict privileged comment creation to signed-in users and make public search obey videos RLS.
-- This migration is intentionally reviewed in GitHub first; it is not applied to production by this PR.

CREATE OR REPLACE FUNCTION public.search_public_videos(p_query text, p_limit integer DEFAULT 48)
RETURNS SETOF public.videos
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
  SELECT v.*
  FROM public.videos AS v
  WHERE v.visibility = 'public'
    AND v.status = 'published'
    AND v.moderation_status = 'approved'
    AND (
      v.title ILIKE '%' || p_query || '%'
      OR v.description ILIKE '%' || p_query || '%'
      OR EXISTS (
        SELECT 1
        FROM unnest(v.tags) AS t
        WHERE t ILIKE '%' || p_query || '%'
      )
    )
  ORDER BY (v.title ILIKE p_query || '%') DESC, v.views DESC, v.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 48), 100));
$function$;

-- This RPC writes comments, increments video counters, and creates notifications.
-- Its function body checks auth.uid(); remove the anonymous/public execute path as defense in depth.
ALTER FUNCTION public.add_video_comment(uuid, text, uuid)
  SET search_path = pg_catalog, public;

REVOKE EXECUTE ON FUNCTION public.add_video_comment(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_video_comment(uuid, text, uuid) TO authenticated;

-- The public search endpoint remains callable by anon/authenticated, but now runs with caller privileges
-- so the existing videos SELECT RLS policy is enforced rather than bypassed.
GRANT EXECUTE ON FUNCTION public.search_public_videos(text, integer) TO anon, authenticated;
