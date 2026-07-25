-- Luxury compare items — 2026-07-25
--
-- Why: every top AI grounding query Bing Webmaster reports for thecrawli.com is
-- luxury resale ("compare luxury resale prices including fees" 42.4% citation
-- share, "best marketplaces to resell luxury handbags" 42.9%, "luxury
-- consignment platforms comparison" 24.1%). None are streetwear. Before this
-- migration all 15 compare items were streetwear/sneakers/basics with a $1–$28
-- price floor, so the site had no live price data to back the luxury claims its
-- blog posts make. This mixes luxury into the same registry rather than adding a
-- separate surface, and tips the mix majority-luxury.
--
-- These rows need no code change to stay fresh: the daily 6am UTC cron
-- (/api/compare/refresh) selects every `enabled` row, so new items are picked up
-- automatically, and app/sitemap.ts + generateStaticParams read the same table.
--
-- Every `query` below was probed live against all 8 native platforms on
-- 2026-07-25 before being added; each returned listings on 7–8 of 8.

insert into public.compare_items (slug, name, query, description, category) values
  -- ── Handbags ──────────────────────────────────────────────────────────────
  ('chanel-classic-flap',          'Chanel Classic Flap',          'chanel classic flap bag',       'Compare Chanel Classic Flap resale prices across Vestiaire, Poshmark, Mercari, Grailed and more. See the live price spread on 8 marketplaces.', 'luxury-handbags'),
  ('hermes-birkin',                'Hermès Birkin',                'hermes birkin bag',             'Hermès Birkin resale price comparison across 8 secondhand marketplaces. See the current asking-price range side by side.',                     'luxury-handbags'),
  ('louis-vuitton-neverfull',      'Louis Vuitton Neverfull',      'louis vuitton neverfull',       'Compare Louis Vuitton Neverfull resale prices across Vestiaire, Poshmark, Mercari, ThredUp and more.',                                       'luxury-handbags'),
  ('louis-vuitton-speedy',         'Louis Vuitton Speedy',         'louis vuitton speedy',          'Louis Vuitton Speedy resale price comparison. Find the cheapest listing across 8 secondhand platforms.',                                     'luxury-handbags'),
  ('gucci-marmont-bag',            'Gucci Marmont Bag',            'gucci marmont bag',             'Compare Gucci Marmont bag resale prices across 8 marketplaces, from Vestiaire and Poshmark to Mercari and Vinted.',                          'luxury-handbags'),
  ('dior-saddle-bag',              'Dior Saddle Bag',              'dior saddle bag',               'Dior Saddle Bag resale price comparison across Vestiaire, Grailed, Poshmark, Mercari and more.',                                            'luxury-handbags'),
  ('prada-re-edition-nylon-bag',   'Prada Re-Edition Nylon Bag',   'prada re edition nylon bag',    'Compare Prada Re-Edition nylon bag resale prices across 8 secondhand marketplaces in one view.',                                            'luxury-handbags'),
  ('celine-triomphe-bag',          'Celine Triomphe Bag',          'celine triomphe bag',           'Celine Triomphe resale price comparison across Vestiaire, Poshmark, Grailed, Mercari and more.',                                            'luxury-handbags'),
  ('bottega-veneta-cassette-bag',  'Bottega Veneta Cassette Bag',  'bottega veneta cassette bag',   'Compare Bottega Veneta Cassette resale prices across 8 secondhand marketplaces.',                                                           'luxury-handbags'),
  ('fendi-baguette-bag',           'Fendi Baguette Bag',           'fendi baguette bag',            'Fendi Baguette resale price comparison. See the live asking-price spread across 8 resale platforms.',                                       'luxury-handbags'),
  ('goyard-st-louis-tote',         'Goyard St Louis Tote',         'goyard st louis tote',          'Compare Goyard St Louis tote resale prices across Vestiaire, Poshmark, Grailed, Mercari and more.',                                         'luxury-handbags'),
  ('ysl-loulou-bag',               'YSL Loulou Bag',               'ysl loulou bag',                'Saint Laurent Loulou resale price comparison across 8 secondhand marketplaces.',                                                            'luxury-handbags'),

  -- ── Small leather goods and accessories ───────────────────────────────────
  ('hermes-silk-scarf',            'Hermès Silk Scarf',            'hermes silk scarf',             'Compare Hermès silk scarf resale prices across Vestiaire, Poshmark, eBay-adjacent marketplaces and more. Live asking-price spread on 8 platforms.', 'luxury-accessories'),
  ('louis-vuitton-wallet',         'Louis Vuitton Wallet',         'louis vuitton wallet',          'Louis Vuitton wallet resale price comparison across 8 secondhand marketplaces.',                                                            'luxury-accessories'),

  -- ── Watches ───────────────────────────────────────────────────────────────
  ('rolex-datejust',               'Rolex Datejust',               'rolex datejust',                'Compare Rolex Datejust resale prices across 8 secondhand marketplaces. See the current asking-price range side by side.',                    'luxury-watches'),
  ('cartier-tank-watch',           'Cartier Tank Watch',           'cartier tank watch',            'Cartier Tank resale price comparison across Vestiaire, Grailed, Poshmark, Mercari and more.',                                               'luxury-watches'),
  ('omega-speedmaster',            'Omega Speedmaster',            'omega speedmaster',             'Compare Omega Speedmaster resale prices across 8 secondhand marketplaces in one view.',                                                     'luxury-watches'),

  -- ── Jewelry ───────────────────────────────────────────────────────────────
  ('cartier-love-bracelet',        'Cartier Love Bracelet',        'cartier love bracelet',         'Cartier Love bracelet resale price comparison across Vestiaire, Poshmark, Mercari, Grailed and more.',                                      'luxury-jewelry')
on conflict (slug) do nothing;

-- Result: 18 luxury items vs 15 streetwear/basics (55% luxury).
--
-- The initial backfill surfaced accessory/replica contamination in floors
-- (a dust-bag "Birkin" at $17.96, a book listed as a "Cartier Tank"). Fixed via
-- filterAuthentic() in app/api/compare/refresh/route.ts (2026-07-25), scoped to
-- this refresh path only. Residual edge cases that survive title-text matching
-- are disclosed directly in each item's dedicated blog post
-- (content/blog/<slug>-resale-price.md) rather than filtered. See HANDOFF.md
-- "Open issues" for what's caught vs residual.
