-- B2B Foundation (Session 1): prepaid search credits + boolean alert criteria.
-- Run this in the Supabase SQL editor BEFORE deploying the matching code.
-- Idempotent (IF NOT EXISTS) so re-runs are safe. Both changes are additive and
-- backward-compatible: existing rows default to no credits / null criteria and
-- behave exactly as before.

-- 1. Prepaid overage credits. Drawn down by the search API once a tier's
--    included searches (TIER_CAPS.maxSearchesPerPeriod) are spent, and granted
--    by the Stripe webhook on a completed one-time credit-pack checkout.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS search_credits int NOT NULL DEFAULT 0;

-- 2. AND-only boolean sourcing criteria for saved searches (brand AND size AND
--    price<X). Applied as a post-filter in lib/alertRunner.ts over fetched
--    listings. Null = legacy behaviour (no extra filtering).
ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS criteria jsonb;
