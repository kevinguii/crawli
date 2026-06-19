-- Phase 1: fix social content dedup memory (2026-06-19)
-- Problem: daily-content-email logged ALL 15 generated social ideas every run
-- (posted or not), so content_history filled with never-posted ideas and the
-- model's own repeats fed back as "already covered" memory. 45% of rows had a
-- null topic_key (the primary dedup key). No "actually posted" layer existed for
-- social, unlike blog which has published_posts.
--
-- Fix: add a `posted` flag so social gets the same two-layer dedup as blog
--   - posted=true  -> hard dedup, all-time (the published_posts equivalent)
--   - posted=false -> soft dedup, recent window only (resurface unused ideas)

-- 1. Add the posted flag (default false = generated-but-not-posted)
ALTER TABLE public.content_history
  ADD COLUMN IF NOT EXISTS posted boolean NOT NULL DEFAULT false;

-- 2. Backfill null topic_keys from the title (mechanical slugify) so historical
--    rows are usable by topic_key dedup. Keep it short (<= 6 words).
UPDATE public.content_history
SET topic_key = trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g'))
WHERE topic_key IS NULL OR topic_key = '';

-- 3. Mark posted=true for the subjects the 3 shipped batches actually covered
--    (2026-06-15 / 06-16 / 06-18). Includes synonym-key variants because the
--    generator invented near-duplicate keys for the same subject.
UPDATE public.content_history
SET posted = true
WHERE kind = 'social' AND topic_key = ANY (ARRAY[
  -- marketplaces / where to sell
  'best-niche-marketplaces','best-sites-secondhand-clothes','where-to-sell-vintage-clothing-online','platform-fees-overview',
  -- denim
  'denim-evolution','denim-history',
  -- slow / sustainable fashion
  'vintage-slow-fashion','sustainable-fashion-practices','current-trends-sustainable-fashion','sustainable-fashion-future',
  -- pricing
  'how-to-price-secondary-clothes','pricing-tips','underpricing-secondhand-items',
  -- eras
  '90s-legacy',
  -- leather
  'understanding-leathers','how-to-find-real-leather',
  -- collectors / sellers / stories
  'vintage-collectors','reseller-journeys','reseller-success-stories','successful-reseller-tips','successful-vintage-sellers',
  -- fabric / quality
  'understanding-fabrics','cotton-vs-synthetic',
  -- sizing
  'vintage-sizing',
  -- resale / vintage trends
  'resale-market-trends','trending-vintage-fashion-styles-2026','trending-vintage-styles-2026','trending-vintage-hues',
  -- shipping
  'shipping-best-practices','shipping-practices',
  -- myths
  'fashion-brand-myths','vintage-myths','reselling-myths',
  -- depop profile
  'creating-engaging-depop-profiles','depop-optimization',
  -- band tees
  'finding-band-tees','origin-of-band-tees'
]);

-- 4. Helpful index for the new posted-aware + recency read
CREATE INDEX IF NOT EXISTS content_history_posted_created_idx
  ON public.content_history (kind, posted, created_at DESC);
