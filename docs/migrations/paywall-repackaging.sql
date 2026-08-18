-- Paywall repackaging — applied to prod 2026-08-17.
-- Spec: docs/superpowers/specs/2026-08-17-paywall-repackaging-design.md
--
-- Three plans -> two (free, pro). Gates move off inert quotas and onto things
-- felt on every use. Idempotent; safe to re-run.

-- ── 1. `saves` was completely ungated. New cap column. ──────────────────────
alter table public.profiles
  add column if not exists max_saves int not null default 10;

-- Grants on `profiles` are COLUMN-level (a consequence of the 2026-08-15
-- privilege-escalation fix, which replaced the table-level GRANT with an
-- enumerated one). A new column therefore inherits NOTHING and 42501s on read
-- until granted explicitly. Do NOT "fix" this with a table-level grant — that
-- reopens the hole. Entitlement columns are service_role-writable only.
grant select (max_saves) on public.profiles to authenticated;
grant select (max_saves), update (max_saves) on public.profiles to service_role;

-- ── 2. Column defaults ARE the free plan for new signups. ───────────────────
alter table public.profiles
  alter column max_saved_searches      set default 1,    -- was 2
  alter column max_tracked_listings    set default 10,   -- was 50
  alter column native_results_cap      set default 8,    -- was 15
  alter column min_alert_cadence_hours set default 24,   -- unchanged: free keeps DAILY alerts
  alter column max_searches_per_period set default 5;    -- unchanged, pinned explicitly

-- ── 3. Hard cutover backfill. ───────────────────────────────────────────────
-- Enforcement reads `profiles` DB-first, so changing TIER_CAPS without this
-- does nothing for existing users. This is the step missed on 2026-06-29.
--
-- Existing rows above the new caps are NOT truncated: saves/alerts/watchlist
-- enforcement is insert-only, so an over-cap user keeps everything and is simply
-- blocked from adding more until they are back under.

update public.profiles set
  max_searches_per_period = 40,
  max_saved_searches      = 8,
  max_tracked_listings    = 500,
  native_results_cap      = 60,
  min_alert_cadence_hours = 24,
  max_saves               = 500
where subscription_tier = 'pro';

update public.profiles set
  max_searches_per_period = 5,
  max_saved_searches      = 1,
  max_tracked_listings    = 10,
  native_results_cap      = 8,
  min_alert_cadence_hours = 24,   -- free keeps DAILY alerts; gated by count, not frequency
  max_saves               = 10
where subscription_tier = 'free';

-- Verify with: npx tsx scripts/verify-paywall.mts
