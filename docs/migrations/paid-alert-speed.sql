-- Paid alert-speed customization — applied 2026-08-26.
-- Spec: docs/ARCHIVED_SPECS.md (§ 2026-08-25 paid alert-speed)
--
-- Pro/Max's alert-cadence floor moves 24 -> 1 (hourly allowed). Free is
-- unchanged. Idempotent; safe to re-run.
--
-- Enforcement reads `profiles` DB-first, so changing TIER_CAPS without this
-- backfill does nothing for existing paid users — same mistake already
-- documented in paywall-repackaging.sql, not repeating it here.
--
-- Existing alerts are NOT touched — their stored cadence_hours keeps whatever
-- value they already had (24, since that was the only option before this
-- change). This migration only widens what a paid user is ALLOWED to pick
-- going forward; nobody's existing alert changes speed on its own.

update public.profiles set
  min_alert_cadence_hours = 1
where subscription_tier in ('pro', 'max');

-- Verify with: npx tsx scripts/verify-paywall.mts
