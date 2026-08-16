-- HkTube Phase 1 schema additions
-- Adds: video_type, tags, language, allow_comments, allow_downloads to signals
-- Adds: posts table, notifications table

-- Add new columns to signals table (if not exist)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'signals' AND column_name = 'video_type') THEN
    ALTER TABLE public.signals ADD COLUMN video_type text NOT NULL DEFAULT 'video' CHECK (video_type IN ('video', 'short'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'signals' AND column_name = 'tags') THEN
    ALTER TABLE public.signals ADD COLUMN tags text[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'signals' AND column_name = 'language') THEN
    ALTER TABLE public.signals ADD COLUMN language text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'signals' AND column_name = 'allow_comments') THEN
    ALTER TABLE public.signals ADD COLUMN allow_comments boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'signals' AND column_name = 'duration_seconds') THEN
    ALTER TABLE public.signals ADD COLUMN duration_seconds integer;
  END IF;
END $$;

-- Posts table
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(trim(content)) > 0),
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS posts_user_idx ON public.posts (user_id, created_at DESC);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'posts_select_public') THEN
    CREATE POLICY posts_select_public ON public.posts FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'posts_insert_own') THEN
    CREATE POLICY posts_insert_own ON public.posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'posts_delete_own') THEN
    CREATE POLICY posts_delete_own ON public.posts FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  type text DEFAULT 'general',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications (user_id, read) WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_select_own') THEN
    CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_update_own') THEN
    CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_insert_system') THEN
    CREATE POLICY notifications_insert_system ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- Add index for video_type filtering
CREATE INDEX IF NOT EXISTS signals_type_idx ON public.signals (video_type, visibility, created_at DESC);

-- RPC for incrementing views (safe concurrent increment)
CREATE OR REPLACE FUNCTION public.increment_views(video_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.signals SET views = views + 1 WHERE id = video_id;
END;
$$;
