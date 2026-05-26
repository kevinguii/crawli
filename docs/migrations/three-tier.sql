-- Three-tier model: Free / Pro / Max.
-- Run this in the Supabase SQL editor BEFORE deploying the matching code.
-- Idempotent (IF NOT EXISTS) so re-runs are safe.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier        text NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'max'
  ADD COLUMN IF NOT EXISTS max_searches_per_period  int  NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_tracked_listings     int  NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS native_results_cap       int  NOT NULL DEFAULT 10;

-- Backfill currently-paying users to NEW Pro caps (75 / 3 / 200 / 30).
-- The 100-searches / 5-alerts numbers from the previous single-Pro era
-- are intentionally dropped.
UPDATE public.profiles
SET subscription_tier       = 'pro',
    max_searches_per_period = 75,
    max_saved_searches      = 3,
    max_tracked_listings    = 200,
    native_results_cap      = 30
WHERE subscription_status IN ('active', 'past_due');

-- Sanity check (read-only):
-- SELECT subscription_tier, count(*) FROM public.profiles GROUP BY subscription_tier;
