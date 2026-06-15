-- Three-tier model: Free / Pro / Max.
-- Run this in the Supabase SQL editor BEFORE deploying the matching code.
-- Idempotent (IF NOT EXISTS) so re-runs are safe.
--
-- NOTE: this file is a historical reference only. The live DB already has
-- these columns. All cap updates in production are driven by the Stripe
-- webhook (app/api/webhooks/stripe/route.ts) using TIER_CAPS from lib/stripe.ts
-- -- do not hand-edit caps here and apply to prod without also updating TIER_CAPS.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier        text NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'max'
  ADD COLUMN IF NOT EXISTS max_searches_per_period  int  NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS max_tracked_listings     int  NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS native_results_cap       int  NOT NULL DEFAULT 10;

-- Backfill currently-paying users to current Pro caps (matches TIER_CAPS.pro in lib/stripe.ts).
-- Run this only on a fresh DB where the webhook hasn't yet written the correct values.
UPDATE public.profiles
SET subscription_tier       = 'pro',
    max_searches_per_period = 20,
    max_saved_searches      = 3,
    max_tracked_listings    = 200,
    native_results_cap      = 40
WHERE subscription_status IN ('active', 'past_due')
  AND subscription_tier = 'pro';

-- Backfill Max users (matches TIER_CAPS.max in lib/stripe.ts).
UPDATE public.profiles
SET subscription_tier       = 'max',
    max_searches_per_period = 70,
    max_saved_searches      = 10,
    max_tracked_listings    = 1000,
    native_results_cap      = 80
WHERE subscription_status IN ('active', 'past_due')
  AND subscription_tier = 'max';

-- Sanity check (read-only):
-- SELECT subscription_tier, max_searches_per_period, native_results_cap, count(*)
-- FROM public.profiles GROUP BY subscription_tier, max_searches_per_period, native_results_cap;
