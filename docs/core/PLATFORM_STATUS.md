# Platform Status

> **Maintenance rule:** update this table any time a platform's extraction method, viability, or known issues change. This is the single source of truth for per-platform state. Do not duplicate it in docs/HANDOFF.md.

Last verified: 2026-09-02 (full audit of all 9 structured extractors — search-grid extractors in `search_page_extractors.py` and per-listing extractors in `structured_extractors.py` — via live `/scrape-search` and `/refresh-price` calls against real listing URLs on every platform, plus a prod log check; same day, ThredUp's search-grid path was fixed and DOM-rewritten, see below). **Confirmed live in prod 2026-09-07** — it rode along with an unrelated 2026-09-04 deploy (`git pull` on that commit carried the fix's ancestor commit too) and was never marked as such; verified with a direct `/scrape-search` call against the prod sidecar.

## Search extraction (per-platform)

All 9 platforms use **Avenue A** (search-page extraction via `/scrape-search`, 0 Firecrawl credits). **Avenue B (Firecrawl URL discovery + per-listing scrape) is retired** as of 2026-08-25 — eBay was its last user. `PLATFORM_STRATEGY` in `lib/firecrawl.ts` still carries an `ebay` entry, but nothing reaches it from the search path.

| Platform | Avenue | Method | Wait / Notes | Results/page | Status |
|---|---|---|---|---|---|
| **Grailed** | A | `a[href*="/listings/"]` Algolia cards | `wait_for` 2.5s (CSR) | ~40 | ✅ Working |
| **Depop** | A | `div[class*="productCard"]` cards | `wait_for` 2.5s; native tried first always (never pre-probed — block is fingerprint-based, not IP); Firecrawl fallback only if native render actually fails (intermittent) | ~24 | ✅ Working (with fallback) |
| **Mercari** | A | `div[data-testid="ItemContainer"]` (`data-productid` → URL, `ItemName`, `ProductThumbItemPrice`) | Native-first + Firecrawl fallback, like Depop. Verified 2026-06-29: raw HTTP 403s the Hetzner IP but real Chromium renders ~3/4 of searches; the misclassifying probe was removed (`FIRECRAWL_PROBE_PLATFORMS` now empty), so most searches are free and Firecrawl fires only on an actual render miss | ~16 native / ~24 via fallback | ✅ Working (native-first) |
| **ThredUp** | A | DOM `div.item-card` grid (own dedicated fresh-launch `UndetectedAdapter` browser per request, not the shared pool) | ~10s render, +1 sequential retry on an empty grid | up to 119/page | ✅ Working again (fixed 2026-09-02, **live in prod**) — see Open platform issues for why it needed a whole new render path, not just a selector fix |
| **Vestiaire** | A | `a[data-cy^="catalog__productCard__"]` brand ALLCAPS→`.title()` | `wait_for` 2s, 60s timeout (CSR ~8s hydration) | ~15 | ✅ Working |
| **Vinted** | A | `div[class*="new-item-box__container"]` + overlay `title` attr CSV | 12s wait (SSR) | ~96 | ✅ Working |
| **Poshmark** | A | `div.tile-grid-redesign__media--wrapper` dual-anchor | `wait_for` `a.tile-grid-redesign__meta-link` 11s | ~48 | ✅ Working |
| **StockX** | A | `[data-testid="ProductTile"]` + `product-tile-lowest-ask-amount` | `wait_for` 12s, 60s timeout (CSR heavy) | ~40 | ✅ Working |
| **eBay** | A | `.su-card-container` cards on `/sch/i.html?_nkw=` (`.s-card__title .su-styled-text`, `.s-card__price`, `.s-card__subtitle` → condition + size) | **No `wait_for` — SRP is server-rendered and one is actively harmful, see PITFALLS.** Firecrawl fallback on 403 | ~75 | ✅ Working (native, migrated 2026-08-25) |
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
| eBay | JSON-LD `Product` block | Watchlist-refresh only now — the search path no longer scrapes eBay per-listing. Intermittent Akamai 403; LLM fallback on failure |
| Vestiaire | JSON-LD `Product` block (`ImageObject.contentUrl` for image) | |
| ThredUp | JSON-LD `Product` block (via `/scrape`, not used in search path) | **Still broken** — unlike the search-grid path (fixed 2026-09-02, see above), the per-listing product page hard-blocks every render regardless of headless mode or a warmed session; hits at the HTTP tier, the Playwright tier, and even the LLM fallback (Playwright never gets past the block to hand the LLM real HTML) |

## Color extraction coverage

| Platform | Structured color? | Source | Fallback |
|---|---|---|---|
| ThredUp | ❌ (regressed 2026-09-02) | Was JSON-LD `Product.color`; that field is gone since ThredUp's redesign and the new DOM grid doesn't surface color per card | title-text |
| Poshmark | ✅ | JSON-LD per-listing | title-text |
| eBay | ❌ on the search path | Grid cards carry no color (per-listing JSON-LD did, 4/5, but search no longer fetches it) | title-text |
| StockX | ✅ | JSON-LD per-listing (official colorway e.g. "Diffused Blue") | title-text |
| Vinted | ✅ | JSON-LD per-listing (`"Blue"` etc.) | title-text |
| Mercari | Partial | Title text only on native-grid path | title-text |
| Depop | ❌ | No color in JSON-LD | title-text |
| Grailed | ❌ | No color in JSON-LD | title-text |
| Vestiaire | Unverified | — | title-text |

Color is a **sort boost** (never a hard drop). Structured color reorders results within the cap; it never removes a listing.

## Open platform issues

**ThredUp — full outage fixed 2026-09-02 (was live since ~2026-08-28), search-grid only, confirmed live in prod 2026-09-07**
- **Root cause (found 2026-09-02): Cloudflare Bot Management, added to thredup.com ~2026-08-28.** `crawl4ai`'s antibot detector fired `Blocked by anti-bot protection: Cloudflare JS challenge` on essentially every render from both the prod Hetzner datacenter IP and a non-hosting-provider IP — confirming it's a fingerprint/behavior-based challenge, not an IP-reputation block. Confirmed via prod log: every ThredUp search returned 0 listings for 6 straight days (`2026-08-27 16:02:58` was the last real result), including the site's own health-check rotation and the 5 curated homepage hero items.
- **Fix: a dedicated one-shot `UndetectedAdapter` browser per ThredUp search**, `_thredup_undetected_render()` in `main.py`. Verified live: `UndetectedAdapter` reliably beats the challenge, but **only for a browser's first request** — a second request reusing the same session gets a harder flat HTTP 403 every time (tried warmed sessions, headless and non-headless; none of it changes this). So ThredUp cannot share the pooled-crawler pattern every other platform uses, or even a persistent dedicated crawler like RealReal's — every search launches a fresh Chromium, renders once, and closes it.
- **Capped at `_thredup_semaphore` (1 concurrent launch), separate from the shared pool's `_render_semaphore`.** A full browser launch per request is real memory pressure, and `SIDECAR_MAX_CONCURRENT_RENDERS` was just cut 6→2 after the 2026-08-29 OOM incidents (see docs/HANDOFF.md) — this cap is what stops ThredUp from stacking extra concurrent Chromium processes on top of the rest of a 9-platform fan-out. The render itself still goes through `_scheduled_render`, so it also respects the shared pool's semaphore, per-domain pacing, and `/health`'s in-flight counter.
- **One sequential retry on an empty grid.** Even a successful-looking render (200, no antibot error) occasionally never hydrates the grid — same soft-block shape already documented for Depop/Vinted, measured here at roughly 1 in 5 renders. A second fresh browser (still sequential, still under the cap of 1) reliably recovers it; testing after adding the retry was 8/8 clean.
- **Separately, and independent of the anti-bot fix: ThredUp's page itself was redesigned.** The old `Product`-array JSON-LD this extractor read is gone — the page's only JSON-LD now is a bare `ItemList` of `{position, url}` stubs, no price/title/image/condition. All of that now lives DOM-only on each `div.item-card` (new classes: `heading-xs-serif` for brand, `body-copy-bold` for price — tag-agnostic, a `<strong>` when there's no discount vs two `<span>`s when there is, `item-card-image` for photos). `extract_thredup_grid` in `search_page_extractors.py` was rewritten from scratch for this; verified 119/119 cards extracted correctly (price, title, size, image) across a live query with no missing fields, including both the discounted and non-discounted price shapes.
- **Still broken, not fixed by any of the above: the per-listing product page.** Tried headless, non-headless, fresh session, and a session warmed by visiting the search page first — the product page (`/product/...`) hard-blocks every time regardless (a flat 403, harder than the search page's challenge). This only matters for `/refresh-price` (watchlist price-refresh on a tracked ThredUp item), which was already broken and stays exactly as broken — no regression, just no improvement there. `extract_thredup` in `structured_extractors.py` is untouched.
- **Color extraction is now unavailable** for ThredUp's search grid — the old JSON-LD `color` field is gone and the new DOM layout doesn't surface color per card. Downgraded in the table below.
- **Confirmed live in prod 2026-09-07.** Latency per ThredUp search is ~10-20s (up to ~35-40s on the retry path) since it can't reuse a warm pool member — worth watching in case it becomes the long pole in a 9-platform fan-out, though nowhere near the old pre-migration eBay/Avenue B problem (60s+).

**eBay — Akamai 403s, now largely mitigated**
- **Search path (fixed 2026-08-25):** the SRP is fetched once instead of 10 per-listing pages, so there is ~1/10th the block surface. Measured from the production Hetzner IP: **8/8 concurrent queries succeeded**, 65-82 listings each, no interstitial. When a 403 does land it is detected in ~3s (no `wait_for` to burn) and the Firecrawl fallback returns a full grid for ~1 credit.
- **Do not add a `wait_for` to eBay's search render.** It cannot help (the cards are in the initial HTML) and it turns a 3s failure into a ~100s one. See PITFALLS.
- **Watchlist refresh** still scrapes eBay per-listing and still sees ~1-in-5 403s there; `[structured] crawl failed` then cascades to the LLM tier.
- Options if the SRP itself starts getting walled: residential proxy; eBay Browse API (requires OAuth); paid unlocker.

**Vestiaire — brand title-casing (fixed 2026-08-25)**
- Brands ship ALL CAPS and are title-cased for display; `str.title()` produced `"Levi'S"`. `_vestiaire_title_case()` repairs a lone trailing `S` after an apostrophe only, so `O'Neill`/`L'Occitane` stay correct. Display-only — matching was never affected. See PITFALLS.

**StockX — SSR vs live price drift**
- Possible that `trade-box-buy-amount` in SSR HTML differs from live hydrated DOM.
- User decision: leave as-is; add "scraped at" timestamp if it becomes a complaint.

**Depop — intermittent Playwright fingerprint block**
- Raw HTTP always 403s but real browser often passes, so native render is tried first.
- Do NOT probe Depop before render (unlike Mercari) — probe would force paid Firecrawl over a working free path.
- Confirmed in code 2026-06-29: `depop` is in `main.py`'s `FIRECRAWL_FALLBACK_PLATFORMS` but NOT in `FIRECRAWL_PROBE_PLATFORMS` — fallback only fires on an actual native-render failure, not a pre-check.

**Depop — CSS Modules class prefix rotated, silently returning 0 results (fixed 2026-08-15)**
- User report: "bape t shirt" (previously reliable) returned 0 Depop results. Root cause: Depop shipped a build where its scoping prefix changed from `styles_productCardRoot__<hash>` to `styles-module__<hash>__productCardRoot` — same for `brandName`/`sizeAttributeText` — so `extract_depop_grid`'s `[class*='styles_productCardRoot']` selector stopped matching even on a fully-rendered 200 OK page with 24 real `/products/` links present. `result.success` stayed `True` throughout — a render succeeding but a selector going stale look identical from the crawl4ai layer.
- Fixed in `search_page_extractors.py`: selectors now match on the semantic suffix only (`[class*='productCardRoot']`, `[class*='brandName']`, `[class*='sizeAttributeText']`), not the `styles_`/`styles-module__` prefix, since Depop's own hashing scheme is what rotates — the human-readable name is what stays stable across rebuilds. Re-verify the docstring's card-structure dump in `extract_depop_grid` if extraction silently drops to 0 again.
- Also added (same session, defense-in-depth, not the fix for this specific bug): `main.py`'s pool crawler now recycles a browser after `SIDECAR_POOL_RECYCLE_AFTER_REQUESTS`/`_SECONDS` (env-tunable, default 25 renders / 30 min), clears cookies on the Depop/Mercari context after every search-page render, and — when a Depop/Mercari render reports success but the grid comes back empty for any reason (selector drift, a genuine anti-bot soft-block) — force-recycles that pool member and retries once via Firecrawl before giving up. See PITFALLS.md "Depop CSS Modules prefix rotation" for the full diagnostic trail.

**Vinted — same class-prefix-rotation bug, different shape (fixed 2026-08-15)**
- Found during a full-platform audit after the Depop fix above. Vinted's build glues its scoping prefix onto class names with no separating space — `class="ItemBox-module-scss-module__NoC3Da__new-item-box__container"` is one token — so `extract_vinted_grid`'s old exact-token dot-selectors (`div.new-item-box__container`, `a.new-item-box__overlay`) stopped matching. Fixed the same way as Depop: switched to `[class*=...]` substring selectors. Every other native platform (Grailed, Mercari, ThredUp, Vestiaire, Poshmark, StockX) was live-tested in the same audit and confirmed still returning real results.
- **Poshmark's extractor uses the identical brittle exact-token dot-selector style** (`div.tile-grid-redesign__media--wrapper`, `a.tile-grid-redesign__meta-link`, etc., in `extract_poshmark_grid`). Currently working, not touched — flagged here as the same latent risk if Poshmark ever glues a prefix the same way Vinted did.

**Grailed — Tier 2 LLM extraction returns empty (found 2026-08-13, unfixed)**
- Only matters when Tier 1 JSON-LD misses, which is rare — Tier 1 is `✅ Working` per the table above, so this is low-impact.
- Verified by forcing `/scrape` past Tier 1 on 3 live Grailed listings: `LLMExtractionStrategy` completes in 0.00s with no LiteLLM API call ever made ("no extracted content" logged), for both `openai/gpt-4o-mini` and `deepseek/deepseek-v4-flash` — same result for both providers, so it's a scoping bug, not a provider issue.
- Likely cause: `PLATFORM_CRAWLER_OPTIONS["grailed"]["target_elements"]` in `extractors.py` (`#listing-page`, `main`, `article`) no longer matches Grailed's current DOM, so the scoped content handed to the LLM is empty and the strategy short-circuits before calling out.
- Not fixed — Tier 1 covers Grailed reliably today, so this is dormant risk, not an active outage. Fix by re-deriving the current listing-page container selector before Grailed's JSON-LD ever regresses.

**Poshmark/StockX grid images were missing/wrong below the fold (fixed 2026-06-30)**
Both grids lazy-load card images via IntersectionObserver: Poshmark ships `data-src` (no `src`) until a card scrolls into view; StockX ships `src` pointing at its own gray-X `Product-Placeholder-Default-*.jpg` until the real image swaps in. `wait_for` only waits for the first card to exist, so anything below the fold was captured mid-lazy-load — Poshmark showed "No image", StockX showed the gray-X graphic. Fixed in `main.py`'s `_LAZY_IMAGE_SCROLL_JS` (`js_code`, runs after `wait_for`/before HTML capture): scrolls the page in viewport steps, capped at 20 steps/~6s, before the DOM is captured. Defense-in-depth in `search_page_extractors.py`: Poshmark falls back to `data-src` if `src` is still empty; StockX nulls out `imageUrl` if it still matches the placeholder filename (some StockX listings genuinely have no real photo — verified live, this is correct behavior, not a residual bug).

## Adding a new platform

Follow the Avenue A survey playbook in `docs/core/SYSTEM_DESIGN.md §Path A`. Key checklist:
1. Probe the search page HTML — is it SSR or CSR? Does it have JSON-LD array, `__NEXT_DATA__`, or DOM cards?
2. Add extractor to `crawl4ai-service/search_page_extractors.py` + `wait_for` in `main.py`
3. Add to `SEARCH_PAGE_PLATFORMS` in **both** `crawl4ai-service/search_page_extractors.py` AND `lib/scraper.ts`
4. Add to `NATIVE_PLATFORMS` in `lib/types.ts`
5. Update this table and docs/HANDOFF.md current-state block
