-- Stripe webhook idempotency (2026-06-30)
--
-- Stripe delivers webhooks at-least-once: it retries on non-2xx responses and
-- can occasionally send the same event twice. Without a guard, a re-delivered
-- `checkout.session.completed` for a credit-pack purchase would grant the
-- search credits AGAIN (the grant is a read-modify-write add, not idempotent).
--
-- This table records every event_id we have fully processed. The webhook claims
-- an event by inserting its id BEFORE doing the work; a duplicate delivery hits
-- the primary-key conflict and is skipped. If processing fails, the handler
-- deletes its claim so Stripe's retry can re-process (claim-with-rollback).
--
-- Written/read by the Stripe webhook via the service-role admin client only.
-- Per docs/core/PITFALLS.md: every new table needs explicit GRANTs. Only service_role
-- touches this one, so there is no `authenticated` grant and no RLS policy.

create table if not exists public.stripe_webhook_events (
  event_id     text primary key,
  type         text,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

grant select, insert, update, delete on public.stripe_webhook_events to service_role;
