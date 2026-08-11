-- Onboarding flow state. See docs/superpowers/specs/2026-08-10-onboarding-flow-design.md.
--
-- onboarding_completed_at is THE GATE: null means the user is blocked into the flow.
-- Every existing account defaults to null, so the 39 current users are onboarded on
-- their next visit with no backfill required.
--
-- IMPORTANT: do NOT add these columns to handle_new_user()'s explicit INSERT list.
-- Hardcoding values there is what caused the free-tier cap bugs on 2026-07-17 and
-- 2026-07-23. New rows must fall through to these DEFAULTs.

alter table public.profiles
  add column if not exists onboarding_persona text
    check (onboarding_persona is null or onboarding_persona in ('buyer', 'reseller')),
  add column if not exists onboarding_started_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_step integer not null default 0;

-- Column additions inherit public.profiles' existing table-level grants, so no new
-- GRANT is required here (the CLAUDE.md "RLS alone 503s" rule applies to new TABLES).
-- Verified after apply by reading the columns back as an authenticated user.
