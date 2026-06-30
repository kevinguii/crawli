-- Compare pages (2026-06-30)
--
-- Powers the public /compare/[slug] pages: a curated set of hand-picked items
-- whose resale prices are scraped daily and cached here. Pages are fully public
-- (no auth required) and serve as SEO/AEO/shareable assets.
--
-- compare_items   — the curated slug registry (admin-managed)
-- compare_snapshots — cached per-platform results, upserted by the daily cron

-- ── compare_items ─────────────────────────────────────────────────────────────

create table if not exists public.compare_items (
  slug        text primary key,
  name        text not null,
  query       text not null,
  description text,
  category    text,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.compare_items enable row level security;

-- Public read: anyone can list items (used by sitemap + page generation).
create policy "compare_items public read"
  on public.compare_items for select
  using (enabled = true);

grant select on public.compare_items to anon, authenticated, service_role;
grant insert, update, delete on public.compare_items to service_role;

-- ── compare_snapshots ─────────────────────────────────────────────────────────

create table if not exists public.compare_snapshots (
  slug            text not null references public.compare_items(slug) on delete cascade,
  platform        text not null,
  listings        jsonb not null default '[]',
  listing_count   int,
  min_price_usd   numeric,
  max_price_usd   numeric,
  avg_price_usd   numeric,
  scraped_at      timestamptz not null default now(),
  primary key (slug, platform)
);

alter table public.compare_snapshots enable row level security;

create policy "compare_snapshots public read"
  on public.compare_snapshots for select
  using (true);

grant select on public.compare_snapshots to anon, authenticated, service_role;
grant insert, update, delete on public.compare_snapshots to service_role;

-- ── Seed: 15 curated slugs ────────────────────────────────────────────────────

insert into public.compare_items (slug, name, query, description, category) values
  ('north-face-nuptse-jacket',       'North Face Nuptse Jacket',        'north face nuptse jacket',         'Compare North Face Nuptse Jacket resale prices across Grailed, Depop, Poshmark, StockX and more.',   'outerwear'),
  ('levis-501-jeans',                'Levi''s 501 Jeans',               'levis 501 jeans',                  'Find the best resale price for Levi''s 501 jeans across 8 secondhand marketplaces.',                 'denim'),
  ('carhartt-wip-jacket',            'Carhartt WIP Jacket',             'carhartt wip jacket',              'Compare Carhartt WIP jacket resale prices. See live comps across Grailed, Depop, eBay and more.',     'outerwear'),
  ('new-balance-550',                'New Balance 550',                 'new balance 550',                  'New Balance 550 resale price comparison across StockX, Grailed, Depop, Poshmark and eBay.',          'sneakers'),
  ('nike-air-force-1',               'Nike Air Force 1',                'nike air force 1',                 'Compare Nike Air Force 1 resale prices. Find the cheapest listing across 8 platforms in one search.', 'sneakers'),
  ('fear-of-god-essentials-hoodie',  'Fear of God Essentials Hoodie',   'fear of god essentials hoodie',    'Fear of God Essentials hoodie resale price comparison across StockX, Grailed, Depop and more.',        'hoodies'),
  ('supreme-box-logo-hoodie',        'Supreme Box Logo Hoodie',         'supreme box logo hoodie',          'Supreme Box Logo hoodie resale prices compared across StockX, Grailed, Depop and eBay.',             'hoodies'),
  ('patagonia-better-sweater',       'Patagonia Better Sweater',        'patagonia better sweater',         'Find the best resale deal on a Patagonia Better Sweater across 8 secondhand platforms.',             'outerwear'),
  ('vintage-band-tee',               'Vintage Band Tee',                'vintage band tee',                 'Compare vintage band tee resale prices. Find authentic vintage band t-shirts across 8 platforms.',    'tops'),
  ('ralph-lauren-polo-shirt',        'Ralph Lauren Polo Shirt',         'ralph lauren polo shirt',          'Ralph Lauren polo shirt resale price comparison across Poshmark, Depop, eBay, Grailed and more.',    'tops'),
  ('jordan-1-retro-high',            'Jordan 1 Retro High',             'jordan 1 retro high',              'Compare Air Jordan 1 Retro High resale prices across StockX, Grailed, Depop and eBay.',             'sneakers'),
  ('bape-shark-hoodie',              'BAPE Shark Hoodie',               'bape shark hoodie',                'BAPE Shark hoodie resale price comparison across Grailed, Depop, StockX and more.',                 'hoodies'),
  ('stussy-hoodie',                  'Stussy Hoodie',                   'stussy hoodie',                    'Compare Stussy hoodie resale prices across Grailed, Depop, Poshmark, eBay and more.',               'hoodies'),
  ('adidas-samba',                   'Adidas Samba',                    'adidas samba',                     'Find the best resale price for Adidas Samba sneakers across StockX, Grailed, Depop and eBay.',      'sneakers'),
  ('nike-dunk-low',                  'Nike Dunk Low',                   'nike dunk low',                    'Nike Dunk Low resale price comparison. Find the cheapest pair across StockX, Grailed and 6 more.',   'sneakers')
on conflict (slug) do nothing;
