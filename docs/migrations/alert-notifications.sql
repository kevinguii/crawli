-- Alert notifications + match persistence (2026-06-30)
--
-- Adds two tables so search alerts produce a visible in-app signal and the
-- actual matched listings can be browsed (previously matches were emailed only
-- and thrown away; an in-app run produced nothing but a counter bump).
--
--   notifications  — one row per alert RUN, every day, regardless of whether
--                    new matches were found (new_count may be 0). Drives the
--                    nav bell badge (= count of unseen rows). This is the
--                    "your alert ran today" signal.
--   alert_matches  — the actual new listings found in a run, so clicking an
--                    alert can render them with the existing ListingCard.
--
-- Rows are written by the alert runner via the service-role admin client
-- (bypasses RLS). Users only ever SELECT/UPDATE/DELETE their own rows, so
-- there is intentionally no INSERT policy for `authenticated`.
--
-- Per docs/PITFALLS.md: RLS alone 503s — every new table needs explicit GRANTs
-- to authenticated + service_role.

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  alert_id    uuid not null references public.saved_searches(id) on delete cascade,
  new_count   integer not null default 0,
  seen        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_unseen_idx
  on public.notifications (user_id, seen);
create index if not exists notifications_alert_idx
  on public.notifications (alert_id);

alter table public.notifications enable row level security;

create policy "users see own" on public.notifications
  for select using (auth.uid() = user_id);
create policy "users update own" on public.notifications
  for update using (auth.uid() = user_id);
create policy "users delete own" on public.notifications
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.notifications to service_role;

-- ---------------------------------------------------------------------------
-- alert_matches
-- ---------------------------------------------------------------------------
create table if not exists public.alert_matches (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  alert_id        uuid not null references public.saved_searches(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete cascade,
  url             text not null,
  title           text,
  price           numeric,
  currency        text,
  image           text,
  platform        text,
  seller          text,
  size            text,
  condition       text,
  color           text,
  seen            boolean not null default false,
  found_at        timestamptz not null default now()
);

create index if not exists alert_matches_alert_idx
  on public.alert_matches (alert_id, found_at desc);
create index if not exists alert_matches_user_unseen_idx
  on public.alert_matches (user_id, seen);

alter table public.alert_matches enable row level security;

create policy "users see own" on public.alert_matches
  for select using (auth.uid() = user_id);
create policy "users update own" on public.alert_matches
  for update using (auth.uid() = user_id);
create policy "users delete own" on public.alert_matches
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.alert_matches to authenticated;
grant select, insert, update, delete on public.alert_matches to service_role;

-- ---------------------------------------------------------------------------
-- Realtime — the nav bell badge subscribes to `notifications` so it lights up
-- live when an alert run inserts a row and clears when they're marked seen.
-- (New tables are NOT auto-added to the publication.)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.notifications;
