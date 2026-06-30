# Design: Public `/compare/[slug]` Pages + GEO Fixes

**Date:** 2026-06-30  
**Status:** Approved — implementing

---

## What we're building

Two workstreams shipping together:

1. **Phase 2 compare pages** — 15 public, no-login pages at `/compare/[slug]` showing cached resale prices across 8 native platforms. Removes the signup-wall activation leak; becomes the Reddit/PH/SEO/AEO asset every other channel needs.
2. **GEO fixes** — `/.well-known/ai.txt`, `/ai/summary.json`, `/ai/faq.json`, `/ai/service.json`, RSS feed link in `<head>`. Raises AI-engine citability.

---

## Data model

### `compare_items` (curated slug list)
| Column | Type | Notes |
|---|---|---|
| slug | text PK | e.g. `north-face-nuptse-jacket` |
| name | text | e.g. `North Face Nuptse Jacket` |
| query | text | actual search string sent to sidecar |
| description | text | short SEO description |
| category | text | `outerwear`, `denim`, `sneakers`, etc. |
| enabled | bool | false = hidden from sitemap + page |

**15 seed slugs:** north-face-nuptse-jacket, levis-501-jeans, carhartt-wip-jacket, new-balance-550, nike-air-force-1, fear-of-god-essentials-hoodie, supreme-box-logo-hoodie, patagonia-better-sweater, vintage-band-tee, ralph-lauren-polo-shirt, jordan-1-retro-high, bape-shark-hoodie, stussy-hoodie, adidas-samba, nike-dunk-low

### `compare_snapshots` (cached results)
| Column | Type | Notes |
|---|---|---|
| slug | text FK | references compare_items |
| platform | text | grailed, depop, etc. |
| listings | jsonb | top 6 Listing objects for display |
| listing_count | int | total found (for "X listings" display) |
| min_price_usd | numeric | lowest price in USD |
| max_price_usd | numeric | highest price in USD |
| avg_price_usd | numeric | mean price in USD |
| scraped_at | timestamptz | when this snapshot was taken |
| PK | (slug, platform) | |

---

## Refresh cron

**Route:** `POST /api/compare/refresh`  
**Auth:** `Authorization: Bearer $CRON_SECRET` (same token as alerts cron)  
**Cron line:** `0 6 * * * curl -s -X POST https://thecrawli.com/api/compare/refresh -H "Authorization: Bearer $CRON_SECRET" >> /var/log/crawli-compare.log 2>&1`

**Flow:** loads all enabled compare_items → for each slug scrapes 8 NATIVE_PLATFORMS via `scrapeSearchPageViaSidecar` + `parseScrapedListings` (concurrency 3 across platforms) → computes stats with `convertToUSD` → upserts snapshots. eBay is NOT scraped (Firecrawl cost); its card on the page links directly to eBay search.

---

## The page (`/compare/[slug]`)

- **Server component**, ISR `revalidate = 3600` (rebuilds hourly from DB)
- **No auth required** — fully public, indexable
- `notFound()` if slug not in compare_items or no snapshot yet

**Layout:**
1. `LandingNav` + `Footer` (same as blog pages)
2. Breadcrumb: Home → Compare → [Item Name]
3. Hero: item name (h1) + "Last updated X hours ago"
4. Platform grid (3-col desktop / 2-col tablet / 1-col mobile): one card per platform showing lowest price, price range, listing count. Cheapest platform highlighted with `--success` border + "Best price" badge. eBay card links to live eBay search.
5. "Top listings from [platform]": 4 simplified read-only cards (no auth hooks) from the cheapest native platform
6. CTA strip: "Search [item] live across 9 platforms" → `/login` + "Set a price alert" → `/login`

**JSON-LD:** `ItemList` with one `ListItem` per platform (`Offer` with `lowPrice`, `highPrice`, `offerCount`). Exactly the schema AI answer engines cite for price comparisons.

**SEO title:** `"[Item Name] Resale Price — Compare Grailed, Depop & 7 More | Crawli"`

---

## GEO endpoints

- `public/.well-known/ai.txt` — static plain-text descriptor for AI crawlers
- `public/ai/summary.json` — name, tagline, description, platforms, pricing
- `public/ai/faq.json` — mirrors FAQ from faqData.ts  
- `public/ai/service.json` — capabilities, endpoints, structured service descriptor
- RSS: `app/feed.xml/route.ts` → blog posts; `<link rel="alternate">` in layout.tsx head

**sameAs note:** LinkedIn/Crunchbase/Wikipedia entries don't exist yet for Crawli. Do NOT add non-existent URLs to sameAs — Google flags the mismatch. Add these when the profiles are actually created.

---

## Files

New:
- `docs/migrations/compare-pages.sql`
- `lib/compare.ts`
- `app/api/compare/refresh/route.ts`
- `app/compare/layout.tsx`
- `app/compare/[slug]/page.tsx`
- `public/.well-known/ai.txt`
- `public/ai/summary.json`
- `public/ai/faq.json`
- `public/ai/service.json`
- `app/feed.xml/route.ts`

Modified:
- `app/sitemap.ts` — add compare slugs
- `app/layout.tsx` — add RSS `<link>` in head

**Do NOT touch:** `/api/search`, `crawl4ai-service/`, `lib/scraper.ts` internals.
