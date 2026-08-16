-- HkTube Phase 2: Monetization, Premium, Payouts, AI Pro

-- Add monetization fields to profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_monetized') THEN
    ALTER TABLE public.profiles ADD COLUMN is_monetized boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_premium') THEN
    ALTER TABLE public.profiles ADD COLUMN is_premium boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'monetization_status') THEN
    ALTER TABLE public.profiles ADD COLUMN monetization_status text NOT NULL DEFAULT 'not_eligible'
      CHECK (monetization_status IN ('not_eligible', 'eligible', 'submitted', 'under_review', 'approved', 'rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'total_watch_time_seconds') THEN
    ALTER TABLE public.profiles ADD COLUMN total_watch_time_seconds bigint NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'badge') THEN
    ALTER TABLE public.profiles ADD COLUMN badge text DEFAULT NULL;
  END IF;
END $$;

-- Earnings table
CREATE TABLE IF NOT EXISTS public.earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount decimal(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  source text NOT NULL DEFAULT 'ads',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS earnings_user_idx ON public.earnings (user_id, created_at DESC);

ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'earnings' AND policyname = 'earnings_select_own') THEN
    CREATE POLICY earnings_select_own ON public.earnings FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'earnings' AND policyname = 'earnings_insert_system') THEN
    CREATE POLICY earnings_insert_system ON public.earnings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Withdrawals table
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount decimal(12,2) NOT NULL CHECK (amount > 0),
  gateway text NOT NULL CHECK (gateway IN ('jazzcash', 'easypaisa', 'bank_transfer', 'payoneer')),
  account_details jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS withdrawals_user_idx ON public.withdrawals (user_id, created_at DESC);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'withdrawals' AND policyname = 'withdrawals_select_own') THEN
    CREATE POLICY withdrawals_select_own ON public.withdrawals FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'withdrawals' AND policyname = 'withdrawals_insert_own') THEN
    CREATE POLICY withdrawals_insert_own ON public.withdrawals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Monetization applications table
CREATE TABLE IF NOT EXISTS public.monetization_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected')),
  subscribers_at_apply integer NOT NULL DEFAULT 0,
  watch_hours_at_apply decimal(10,2) NOT NULL DEFAULT 0,
  applied_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE public.monetization_applications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'monetization_applications' AND policyname = 'monet_app_select_own') THEN
    CREATE POLICY monet_app_select_own ON public.monetization_applications FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'monetization_applications' AND policyname = 'monet_app_insert_own') THEN
    CREATE POLICY monet_app_insert_own ON public.monetization_applications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Premium subscriptions table
CREATE TABLE IF NOT EXISTS public.premium_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan text NOT NULL DEFAULT 'monthly' CHECK (plan IN ('monthly', 'yearly')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE public.premium_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'premium_subscriptions' AND policyname = 'premium_select_own') THEN
    CREATE POLICY premium_select_own ON public.premium_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'premium_subscriptions' AND policyname = 'premium_insert_own') THEN
    CREATE POLICY premium_insert_own ON public.premium_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Function to get creator stats
CREATE OR REPLACE FUNCTION public.get_creator_stats(creator_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub_count bigint;
  video_count bigint;
  total_views bigint;
  watch_time bigint;
  total_earned decimal;
  available_balance decimal;
BEGIN
  SELECT count(*) INTO sub_count FROM public.follows WHERE following_id = creator_uuid;
  SELECT count(*), coalesce(sum(views), 0) INTO video_count, total_views FROM public.signals WHERE creator_id = creator_uuid;
  SELECT coalesce(total_watch_time_seconds, 0) INTO watch_time FROM public.profiles WHERE id = creator_uuid;
  SELECT coalesce(sum(amount), 0) INTO total_earned FROM public.earnings WHERE user_id = creator_uuid;
  SELECT total_earned - coalesce(sum(amount), 0) INTO available_balance FROM public.withdrawals WHERE user_id = creator_uuid AND status IN ('pending', 'processing', 'paid');
  IF available_balance IS NULL THEN available_balance := total_earned; END IF;

  RETURN jsonb_build_object(
    'subscribers', sub_count,
    'videos', video_count,
    'total_views', total_views,
    'watch_time_seconds', watch_time,
    'watch_time_hours', round(watch_time / 3600.0, 1),
    'total_earned', total_earned,
    'available_balance', available_balance
  );
END;
$$;
