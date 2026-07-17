-- Fix: public.profiles column DEFAULTs were never updated when the free
-- tier's pricing changed (docs/migrations/three-tier.sql was written with
-- the old numbers: 3 searches / 1 saved search / 10 native results cap).
-- New signups get their profile row inserted by a Supabase-side trigger
-- that relies on these column defaults, so every new free user since the
-- pricing change was silently getting the OLD limits instead of the
-- current TIER_CAPS.free in lib/stripe.ts (5 / 2 / 15).
--
-- Confirmed via live schema introspection on 2026-07-17: defaults were
-- max_searches_per_period=3, max_saved_searches=1, native_results_cap=10.
-- 2 free users signed up 2026-07-16 got these stale defaults and were
-- backfilled by hand to 5 / 2 / 15 as part of this fix.
--
-- Run this once in the Supabase SQL editor.

ALTER TABLE public.profiles
  ALTER COLUMN max_searches_per_period SET DEFAULT 5,
  ALTER COLUMN max_saved_searches      SET DEFAULT 2,
  ALTER COLUMN native_results_cap      SET DEFAULT 15;
