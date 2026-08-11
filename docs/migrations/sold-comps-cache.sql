-- Sold comps cache (2026-08-10)
--
-- Mirrors search_listings_cache. Sold comps are aggregate figures over a 90-365 day
-- window, so they do not move hour to hour — a 24h TTL is generous and cuts the
-- request volume to the two upstream platforms sharply.
--
-- Per docs/core/PITFALLS.md: RLS alone 503s — every new table needs explicit GRANTs.

create table if not exists public.sold_comps_cache (
  key         text primary key,
  payload     jsonb       not null,
  expires_at  timestamptz not null
);

create index if not exists sold_comps_cache_expires_at_idx
  on public.sold_comps_cache (expires_at);

alter table public.sold_comps_cache enable row level security;

-- Written and read only via the service-role admin client (same as
-- search_listings_cache); authenticated is granted read for parity/debugging.
grant select on public.sold_comps_cache to authenticated;
grant select, insert, update, delete on public.sold_comps_cache to service_role;
