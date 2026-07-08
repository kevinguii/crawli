# Platform Status

> **Maintenance rule:** update this table any time a platform's extraction method, viability, or known issues change. This is the single source of truth for per-platform state. Do not duplicate it in HANDOFF.md.

Last verified: 2026-07-08

## Search extraction (per-platform)

All 8 native platforms use **Avenue A** (search-page extraction via `/scrape-search`, 0 Firecrawl credits). Only eBay uses **Avenue B** (Firecrawl URL discovery + per-listing scrape).

| Platform | Avenue | Method | Wait / Notes | Results/page | Status |
|---|---|---|---|---|---|
| **Grailed** | A | `a[href*="/listings/"]` Algolia cards | `wait_for` 2.5s (CSR) | ~40 | ✅ Working |
| **Depop** | A | `div[class*="productCard"]` cards | `wait_for` 2.5s; native tried first always (never pre-probed — block is fingerprint-based, not IP); Firecrawl fallback only if native render actually fails (intermittent) | ~24 | ✅ Working (with fallback) |
| **Mercari** | A | `div[data-testid="ItemContainer"]` (`data-productid` → URL, `ItemName`, `ProductThumbItemPrice`) | Native-first + Firecrawl fallback, like Depop. Verified 2026-06-29: raw HTTP 403s the Hetzner IP but real Chromium renders ~3/4 of searches; the misclassifying probe was removed (`FIRECRAWL_PROBE_PLATFORMS` now empty), so most searches are free and Firecrawl fires only on an actual render miss | ~16 native / ~24 via fallback | ✅ Working (native-first) |
| **ThredUp** | A | JSON-LD `Product` array + DOM href merge | 3s SSR wait | ~100 | ✅ Working |
| **Vestiaire** | A | `a[data-cy^="catalog__productCard__"]` brand ALLCAPS→`.title()` | `wait_for` 2s, 60s timeout (CSR ~8s hydration) | ~15 | ✅ Working |
| **Vinted** | A | `div.new-item-box__container` + overlay `title` attr CSV | 12s wait (SSR) | ~96 | ✅ Working |
| **Poshmark** | A | `div.tile-grid-redesign__media--wrapper` dual-anchor | `wait_for` `a.tile-grid-redesign__meta-link` 11s | ~48 | ✅ Working |
| **StockX** | A | `[data-testid="ProductTile"]` + `product-tile-lowest-ask-amount` | `wait_for` 12s, 60s timeout (CSR heavy) | ~40 | ✅ Working |
| **eBay** | B | Firecrawl `site:ebay.com` → JSON-LD Product per-listing | Akamai intermittently 403s (~1 in 5 listings); structured extractor handles hits | ~8 | ✅ Working (intermittent Akamai blocks) |
| **RealReal** | — | Disabled | PerimeterX press-and-hold blocks headless render; returns 0 silently | — | ❌ Disabled |

## Per-listing extraction (for Avenue B / watchlist refresh)

| Platform | Tier 1 extractor | Notes |
|---|---|---|
| Grailed | JSON-LD `Product` block | |
| Depop | JSON-LD `Product` block | |
| StockX | `data-testid="trade-box-buy-amount"` | Stale SSR vs live price possible; see PITFALLS.md |
| Poshmark | `og:title` + `og:image` + `<p class="h1"><span>` price | |
| Mercari | `__NEXT_DATA__.serverState[ItemDetail]` price in cents ÷ 100 | |
| Vinted | Regex over escaped RSC payload | |
| eBay | JSON-LD `Product` block | Intermittent Akamai 403; LLM fallback on failure |
| Vestiaire | JSON-LD `Product` block (`ImageObject.contentUrl` for image) | |
| ThredUp | JSON-LD `Product` block (via `/scrape`, not used in search path) | |

## Color extraction coverage

| Platform | Structured color? | Source | Fallback |
|---|---|---|---|
| ThredUp | ✅ | JSON-LD `Product.color` on grid card | title-text |
| Poshmark | ✅ | JSON-LD per-listing | title-text |
| eBay | ✅ (4/5) | JSON-LD per-listing | title-text |
| StockX | ✅ | JSON-LD per-listing (official colorway e.g. "Diffused Blue") | title-text |
| Vinted | ✅ | JSON-LD per-listing (`"Blue"` etc.) | title-text |
| Mercari | Partial | Title text only on native-grid path | title-text |
| Depop | ❌ | No color in JSON-LD | title-text |
| Grailed | ❌ | No color in JSON-LD | title-text |
| Vestiaire | Unverified | — | title-text |

Color is a **sort boost** (never a hard drop). Structured color reorders results within the cap; it never removes a listing.

## Open platform issues

**eBay — intermittent Akamai blocks**
- `[structured] crawl failed` logged when 403. Cascade falls to LLM tier on partial response.
- Options (none implemented): residential proxy; eBay Browse API (requires OAuth); paid unlocker.

**StockX — SSR vs live price drift**
- Possible that `trade-box-buy-amount` in SSR HTML differs from live hydrated DOM.
- User decision: leave as-is; add "scraped at" timestamp if it becomes a complaint.

**Depop — intermittent Playwright fingerprint block**
- Raw HTTP always 403s but real browser often passes, so native render is tried first.
- Do NOT probe Depop before render (unlike Mercari) — probe would force paid Firecrawl over a working free path.
- Confirmed in code 2026-06-29: `depop` is in `main.py`'s `FIRECRAWL_FALLBACK_PLATFORMS` but NOT in `FIRECRAWL_PROBE_PLATFORMS` — fallback only fires on an actual native-render failure, not a pre-check.

**Poshmark/StockX grid images were missing/wrong below the fold (fixed 2026-06-30)**
Both grids lazy-load card images via IntersectionObserver: Poshmark ships `data-src` (no `src`) until a card scrolls into view; StockX ships `src` pointing at its own gray-X `Product-Placeholder-Default-*.jpg` until the real image swaps in. `wait_for` only waits for the first card to exist, so anything below the fold was captured mid-lazy-load — Poshmark showed "No image", StockX showed the gray-X graphic. Fixed in `main.py`'s `_LAZY_IMAGE_SCROLL_JS` (`js_code`, runs after `wait_for`/before HTML capture): scrolls the page in viewport steps, capped at 20 steps/~6s, before the DOM is captured. Defense-in-depth in `search_page_extractors.py`: Poshmark falls back to `data-src` if `src` is still empty; StockX nulls out `imageUrl` if it still matches the placeholder filename (some StockX listings genuinely have no real photo — verified live, this is correct behavior, not a residual bug).

## Adding a new platform

Follow the Avenue A survey playbook in `docs/core/SYSTEM_DESIGN.md §Path A`. Key checklist:
1. Probe the search page HTML — is it SSR or CSR? Does it have JSON-LD array, `__NEXT_DATA__`, or DOM cards?
2. Add extractor to `crawl4ai-service/search_page_extractors.py` + `wait_for` in `main.py`
3. Add to `SEARCH_PAGE_PLATFORMS` in **both** `crawl4ai-service/search_page_extractors.py` AND `lib/scraper.ts`
4. Add to `NATIVE_PLATFORMS` in `lib/types.ts`
5. Update this table and HANDOFF.md current-state block
